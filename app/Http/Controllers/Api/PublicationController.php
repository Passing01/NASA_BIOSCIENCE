<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Publication;
use App\Models\Experiment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Carbon;

class PublicationController extends Controller
{
    /**
     * Display a listing of the resources with filtering and pagination.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $query = Publication::query();

        // Filter by year if provided
        if ($request->has('year')) {
            $query->whereYear('publication_date', $request->year);
        }

        // Filter by source if provided
        if ($request->has('source')) {
            $query->where('source', $request->source);
        }

        // Search in title, abstract, authors, and keywords
        if ($request->has('search')) {
            $searchTerm = $request->search;
            $query->where(function($q) use ($searchTerm) {
                $q->where('title', 'like', "%{$searchTerm}%")
                  ->orWhere('abstract', 'like', "%{$searchTerm}%")
                  ->orWhere('authors', 'like', "%{$searchTerm}%")
                  ->orWhere('keywords', 'like', "%{$searchTerm}%");
            });
        }

        // Order by
        $orderBy = $request->input('order_by', 'publication_date');
        $orderDirection = $request->input('order_direction', 'desc');
        $query->orderBy($orderBy, $orderDirection);

        // Pagination
        $perPage = min($request->input('per_page', 15), 100);
        $publications = $query->paginate($perPage);

        return response()->json($publications);
    }

    /**
     * Display publications for a specific experiment.
     *
     * @param  int  $experimentId
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function indexByExperiment(Request $request, $experimentId): JsonResponse
    {
        $experiment = Experiment::findOrFail($experimentId);
        $publications = $experiment->publications()
            ->orderBy('publication_date', 'desc')
            ->paginate($request->input('per_page', 15));

        return response()->json($publications);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:1000',
            'abstract' => 'nullable|string',
            'doi' => 'nullable|string|max:255|unique:publications,doi',
            'journal' => 'nullable|string|max:500',
            'publisher' => 'nullable|string|max:255',
            'publication_date' => 'required|date',
            'authors' => 'required|string',
            'url' => 'nullable|url|max:1000',
            'pdf_url' => 'nullable|url|max:1000',
            'keywords' => 'nullable|array',
            'source' => 'required|string|max:100',
            'source_id' => 'nullable|string|max:255',
            'metadata' => 'nullable|array',
            'experiment_ids' => 'nullable|array',
            'experiment_ids.*' => 'exists:experiments,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Create the publication
        $publication = Publication::create($request->except('experiment_ids'));

        // Attach to experiments if provided
        if ($request->has('experiment_ids')) {
            $publication->experiments()->sync($request->experiment_ids);
        }

        return response()->json([
            'message' => 'Publication created successfully',
            'data' => $publication->load('experiments'),
        ], 201);
    }

    /**
     * Display the specified resource.
     *
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(string $id): JsonResponse
    {
        $publication = Publication::with('experiments.mission')->findOrFail($id);
        return response()->json(['data' => $publication]);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $publication = Publication::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|required|string|max:1000',
            'abstract' => 'nullable|string',
            'doi' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('publications', 'doi')->ignore($publication->id),
            ],
            'journal' => 'nullable|string|max:500',
            'publisher' => 'nullable|string|max:255',
            'publication_date' => 'sometimes|required|date',
            'authors' => 'sometimes|required|string',
            'url' => 'nullable|url|max:1000',
            'pdf_url' => 'nullable|url|max:1000',
            'keywords' => 'nullable|array',
            'source' => 'sometimes|required|string|max:100',
            'source_id' => 'nullable|string|max:255',
            'metadata' => 'nullable|array',
            'experiment_ids' => 'nullable|array',
            'experiment_ids.*' => 'exists:experiments,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $publication->update($request->except('experiment_ids'));

        // Sync experiments if provided
        if ($request->has('experiment_ids')) {
            $publication->experiments()->sync($request->experiment_ids);
        }

        return response()->json([
            'message' => 'Publication updated successfully',
            'data' => $publication->load('experiments'),
        ]);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  string  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(string $id): JsonResponse
    {
        $publication = Publication::findOrFail($id);
        $publication->delete();

        return response()->json([
            'message' => 'Publication deleted successfully',
        ]);
    }

    /**
     * Get publication statistics.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function statistics(): JsonResponse
    {
        $total = Publication::count();
        $byYear = Publication::selectRaw('YEAR(publication_date) as year, COUNT(*) as count')
            ->whereNotNull('publication_date')
            ->groupBy('year')
            ->orderBy('year', 'desc')
            ->get();

        $bySource = Publication::selectRaw('source, COUNT(*) as count')
            ->groupBy('source')
            ->orderBy('count', 'desc')
            ->get();

        $recent = Publication::orderBy('publication_date', 'desc')
            ->take(5)
            ->get(['id', 'title', 'publication_date']);

        return response()->json([
            'data' => [
                'total' => $total,
                'by_year' => $byYear,
                'by_source' => $bySource,
                'recent' => $recent,
            ],
        ]);
    }

    /**
     * Import publications from external source.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function import(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'source' => 'required|in:doi,crossref,nasa_api',
            'ids' => 'required|array',
            'ids.*' => 'required|string',
            'experiment_id' => 'nullable|exists:experiments,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $imported = [];
        $failed = [];

        foreach ($request->ids as $id) {
            try {
                // In a real application, you would fetch the publication data from the external API
                // For now, we'll just create a placeholder
                $publication = Publication::create([
                    'title' => "Imported Publication: {$id}",
                    'source' => $request->source,
                    'source_id' => $id,
                    'publication_date' => now(),
                    'authors' => 'Various Authors',
                ]);

                if ($request->has('experiment_id')) {
                    $publication->experiments()->attach($request->experiment_id);
                }

                $imported[] = $publication;
            } catch (\Exception $e) {
                $failed[] = [
                    'id' => $id,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'message' => 'Import completed',
            'imported' => count($imported),
            'failed' => count($failed),
            'imported_publications' => $imported,
            'failed_imports' => $failed,
        ]);
    }
}

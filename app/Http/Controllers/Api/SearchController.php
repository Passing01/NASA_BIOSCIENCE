<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Mission;
use App\Models\Experiment;
use App\Models\Publication;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class SearchController extends Controller
{
    /**
     * Perform a global search across missions, experiments, and publications.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function search(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|min:2|max:255',
            'types' => 'nullable|array',
            'types.*' => 'in:missions,experiments,publications',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors(),
            ], 422);
        }

        $query = $request->input('query');
        $types = $request->input('types', ['missions', 'experiments', 'publications']);
        $perPage = min($request->input('per_page', 10), 100);
        $results = [];

        if (in_array('missions', $types)) {
            $results['missions'] = $this->searchMissions($query, $perPage);
        }

        if (in_array('experiments', $types)) {
            $results['experiments'] = $this->searchExperiments($query, $perPage);
        }

        if (in_array('publications', $types)) {
            $results['publications'] = $this->searchPublications($query, $perPage);
        }

        return response()->json([
            'data' => $results,
            'meta' => [
                'query' => $query,
                'types' => $types,
            ],
        ]);
    }

    /**
     * Search in missions.
     *
     * @param  string  $query
     * @param  int  $perPage
     * @return \Illuminate\Pagination\LengthAwarePaginator
     */
    protected function searchMissions(string $query, int $perPage = 10)
    {
        return Mission::where('name', 'like', "%{$query}%")
            ->orWhere('description', 'like', "%{$query}%")
            ->orWhere('agency', 'like', "%{$query}%")
            ->orderBy('start_date', 'desc')
            ->paginate($perPage);
    }

    /**
     * Search in experiments.
     *
     * @param  string  $query
     * @param  int  $perPage
     * @return \Illuminate\Pagination\LengthAwarePaginator
     */
    protected function searchExperiments(string $query, int $perPage = 10)
    {
        return Experiment::with('mission')
            ->where('title', 'like', "%{$query}%")
            ->orWhere('description', 'like', "%{$query}%")
            ->orWhere('principal_investigator', 'like', "%{$query}%")
            ->orWhere('organization', 'like', "%{$query}%")
            ->orWhere('discipline', 'like', "%{$query}%")
            ->orderBy('start_date', 'desc')
            ->paginate($perPage);
    }

    /**
     * Search in publications.
     *
     * @param  string  $query
     * @param  int  $perPage
     * @return \Illuminate\Pagination\LengthAwarePaginator
     */
    protected function searchPublications(string $query, int $perPage = 10)
    {
        return Publication::where('title', 'like', "%{$query}%")
            ->orWhere('abstract', 'like', "%{$query}%")
            ->orWhere('authors', 'like', "%{$query}%")
            ->orWhere('journal', 'like', "%{$query}%")
            ->orWhere('keywords', 'like', "%{$query}%")
            ->orderBy('publication_date', 'desc')
            ->paginate($perPage);
    }
}

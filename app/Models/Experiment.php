<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Experiment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'mission_id',
        'title',
        'description',
        'status',
        'start_date',
        'end_date',
        'principal_investigator',
        'organization',
        'discipline',
        'objectives',
        'methodology',
        'results_summary',
        'location',
        'facility',
        'metadata',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'objectives' => 'array',
        'methodology' => 'array',
        'results_summary' => 'array',
        'metadata' => 'array',
    ];

    public function mission()
    {
        return $this->belongsTo(Mission::class);
    }

    public function publications()
    {
        return $this->belongsToMany(Publication::class)
            ->withPivot('relationship_type')
            ->withTimestamps();
    }
}

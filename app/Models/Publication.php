<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Publication extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'title',
        'abstract',
        'doi',
        'journal',
        'publisher',
        'publication_date',
        'authors',
        'url',
        'pdf_url',
        'keywords',
        'source',
        'source_id',
        'metadata',
    ];

    protected $casts = [
        'publication_date' => 'date',
        'keywords' => 'array',
        'metadata' => 'array',
    ];

    public function experiments()
    {
        return $this->belongsToMany(Experiment::class)
            ->withPivot('relationship_type')
            ->withTimestamps();
    }
}

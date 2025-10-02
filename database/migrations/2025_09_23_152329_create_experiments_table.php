<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('experiments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mission_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status'); // planned, in_progress, completed, failed
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->string('principal_investigator')->nullable();
            $table->string('organization')->nullable();
            $table->string('discipline'); // ex: Biology, Physics, etc.
            $table->json('objectives')->nullable();
            $table->json('methodology')->nullable();
            $table->json('results_summary')->nullable();
            $table->string('location')->nullable(); // ISS, Moon, Mars, etc.
            $table->string('facility')->nullable(); // Specific facility/module
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('experiments');
    }
};

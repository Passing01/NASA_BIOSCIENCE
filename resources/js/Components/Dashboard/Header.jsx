import React from 'react';
import { Link } from '@inertiajs/react';
import { House, Bell, Question, Gear } from 'react-bootstrap-icons';

export default function Header({ title, breadcrumbs = [] }) {
    return (
        <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
                <nav aria-label="breadcrumb">
                    <ol className="breadcrumb mb-0">
                        <li className="breadcrumb-item">
                            <Link href="/dashboard" className="text-decoration-none">
                                <House className="me-1" />
                                Accueil
                            </Link>
                        </li>
                        {breadcrumbs.map((item, index) => (
                            <li key={index} className="breadcrumb-item active" aria-current="page">
                                {item}
                            </li>
                        ))}
                    </ol>
                </nav>
                <h1 className="h3 mb-0">{title}</h1>
            </div>
            <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary">
                    <Bell size={20} />
                </button>
                <button className="btn btn-outline-secondary">
                    <Question size={20} />
                </button>
                <button className="btn btn-outline-secondary">
                    <Gear size={20} />
                </button>
            </div>
        </div>
    );
}

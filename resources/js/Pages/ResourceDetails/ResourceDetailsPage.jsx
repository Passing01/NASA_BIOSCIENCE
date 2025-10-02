import React, { useState, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import { Container, Button, Alert, Spinner, Dropdown, Row, Col, Badge, Form, InputGroup, Modal, Card } from 'react-bootstrap';
import { BoxArrowUpRight, Download, FileEarmarkPdf, FileEarmarkWord, Link45deg, FileEarmarkText, Globe, Youtube } from 'react-bootstrap-icons';
import html2pdf from 'html2pdf.js';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// Détecte le type de lien et fournit des métadonnées d'affichage
const getLinkInfo = (url) => {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, '');
        const pathname = u.pathname.toLowerCase();
        const ext = pathname.split('.').pop();
        const isPdf = ext === 'pdf' || u.searchParams.get('format') === 'pdf';
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
        const isYouTube = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host);
        const isGithub = host === 'github.com';
        const isDoi = host.includes('doi.org') || /^10\.\d{4,9}\//.test(url);
        const isFigshare = host.includes('figshare.com');
        const isZenodo = host.includes('zenodo.org');
        const isArxiv = host.includes('arxiv.org');
        const isDataset = isFigshare || isZenodo || (host.includes('genelab') || host.includes('osdr.nasa')); 

        let type = 'site';
        if (isPdf) type = 'pdf';
        else if (isImage) type = 'image';
        else if (isYouTube) type = 'video';
        else if (isGithub) type = 'code';
        else if (isDataset) type = 'dataset';
        else if (isArxiv) type = 'preprint';
        else if (isDoi) type = 'doi';

        return { type, host, ext };
    } catch {
        return { type: 'site', host: '', ext: '' };
    }
};

// Icône adaptée au type de lien
const LinkTypeIcon = ({ type, className }) => {
    switch (type) {
        case 'pdf':
            return <FileEarmarkPdf className={className} />;
        case 'image':
        case 'preprint':
        case 'code':
        case 'dataset':
            return <FileEarmarkText className={className} />;
        case 'video':
            return <Youtube className={className} />;
        case 'doi':
            return <Link45deg className={className} />;
        default:
            return <Globe className={className} />;
    }
};

const ResourceDetailsPage = ({ resource: initialResource }) => {
    const [resource, setResource] = useState(initialResource);
    const [isLoading, setIsLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSummary, setAiSummary] = useState('');
    const [aiKeywords, setAiKeywords] = useState([]);
    const [aiRelated, setAiRelated] = useState([]);
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState(null);
    const contentRef = useRef(null);
    const linkInfo = useMemo(() => getLinkInfo(resource?.url || ''), [resource]);

    // Valeurs mission (avec fallbacks) – vous pouvez les fournir dans resource.mission
    const mission = resource?.mission || {};
    const missionName = mission.name || resource?.title || 'Mission';
    const missionYears = mission.years || mission.year || mission.period || null; // ex: "1966–1975"
    const missionFlights = mission.flights ?? mission.flight_count ?? null;
    const missionFocus = mission.focus || mission.tags?.join(', ') || null;

    // Stats (expériences, publications, organismes)
    const stats = resource?.stats || mission.stats || {};
    const statExperiments = stats.experiments ?? null;
    const statPublications = stats.publications ?? null;
    const statOrganisms = stats.organisms ?? null;

    // Filtres de page (exemple simple)
    const [filters, setFilters] = useState({
        timeframe: missionYears || '',
        type: 'All',
        organism: 'All',
        query: ''
    });

    // Extraire des sections et générer un contenu avec ancres cliquables
    const { sections, contentWithAnchors } = useMemo(() => {
        const empty = { sections: [], contentWithAnchors: resource?.content || '' };
        if (!resource?.content) return empty;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(`<div>${resource.content}</div>`, 'text/html');
            const container = doc.body.firstChild; // notre wrapper div
            const result = [];
            let idx = 0;
            container.querySelectorAll('h1, h2, h3, p').forEach((el) => {
                const text = (el.textContent || '').trim();
                if (!text) return;
                const id = `sec-${idx++}`;
                el.setAttribute('id', id);
                el.style.scrollMarginTop = '80px';
                result.push({ id, tag: el.tagName.toLowerCase(), text });
            });
            return { sections: result, contentWithAnchors: container.innerHTML };
        } catch {
            return empty;
        }
    }, [resource?.content]);

    // Extraction heuristique d'éléments (avec support des champs si fournis)
    const baseExperiments = resource?.experiments || mission.experiments || [];
    const basePublications = resource?.publications || mission.publications || [];
    const baseOrganisms = resource?.organisms || mission.organisms || [];

    const derived = useMemo(() => {
        // Heuristiques simples si pas de données structurées
        const exp = baseExperiments.length
            ? baseExperiments
            : sections.filter(s => /experiment|study|essai|essais|mission|trial/i.test(s.text)).map(s => ({ title: s.text, id: s.id }));

        const pubs = basePublications.length
            ? basePublications
            : (resource?.content ? (resource.content.match(/https?:\/\/(?:\w+\.)?(?:ncbi|doi|nature|science|pubmed|pmc)[^\s"']+/gi) || []).map((u, i) => ({ title: u, url: u, id: `pub-${i}` })) : []);

        const orgList = baseOrganisms.length ? baseOrganisms : (() => {
            const textBlob = (sections.map(s => s.text).join(' ') + ' ' + (resource?.title || '')).toLowerCase();
            const found = new Set();
            if (/\bhuman(s)?\b|homo sapiens|humain/i.test(textBlob)) found.add('Human');
            if (/\bmouse|mice|murine|mus musculus/i.test(textBlob)) found.add('Mouse');
            if (/\bplant(s)?\b|arabidopsis|thaliana|root|seedling/i.test(textBlob)) found.add('Plant');
            if (/\bmicrob(e|ial)|bacteria|yeast|fungi|microorganism/i.test(textBlob)) found.add('Microbe');
            return Array.from(found);
        })();

        return { exp, pubs, orgList };
    }, [baseExperiments, basePublications, baseOrganisms, sections, resource?.content, resource?.title]);

    // Application des filtres
    const filtered = useMemo(() => {
        const byQuery = (txt) => {
            if (!filters.query) return true;
            return (txt || '').toLowerCase().includes(filters.query.toLowerCase());
        };
        const typeMap = {
            Biology: /cell|tissue|biolog|gene|protein|organ/i,
            Radiation: /radiation|ionizing|dose|cosmic|HZE/i,
            Plant: /plant|arabidopsis|root|seed/i,
        };
        const typeMatch = (txt) => {
            if (filters.type === 'All') return true;
            const re = typeMap[filters.type];
            return re ? re.test(txt) : true;
        };
        const organismMatch = (txt) => {
            if (filters.organism === 'All') return true;
            const map = {
                Human: /human|homo sapiens|astronaut/i,
                Mouse: /mouse|mice|murine|mus musculus/i,
                Plant: /plant|arabidopsis|thaliana|root|seedling/i,
                Microbe: /microbe|bacteria|fungi|yeast/i,
            };
            const re = map[filters.organism];
            return re ? re.test(txt) : true;
        };
        const timeframeMatch = (txt) => {
            if (!filters.timeframe) return true;
            return (txt || '').includes(filters.timeframe);
        };

        const inText = (txt) => byQuery(txt) && typeMatch(txt) && organismMatch(txt) && timeframeMatch(txt);

        const filteredSections = sections.filter(s => inText(s.text));
        const filteredExperiments = derived.exp.filter(e => inText(e.title || e.text || ''));
        const filteredPublications = derived.pubs.filter(p => inText(p.title || p.url || ''));

        // Organisms filtrés
        let organismsSet = new Set(derived.orgList);
        if (filters.organism !== 'All') {
            organismsSet = new Set(derived.orgList.filter(o => o === filters.organism));
        }

        return {
            sections: filteredSections,
            experiments: filteredExperiments,
            publications: filteredPublications,
            organisms: Array.from(organismsSet)
        };
    }, [sections, derived, filters]);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({ top: y, behavior: 'smooth' });
    };

    // Partenaires et missions liées (si disponibles)
    const partners = resource?.partners || mission.partners || [];
    const relatedMissions = resource?.related_missions || mission.related_missions || [];

    const handleShare = async () => {
        try {
            const shareData = {
                title: resource?.title || 'Resource',
                text: 'Consult this resource',
                url: typeof window !== 'undefined' ? window.location.href : resource?.url || ''
            };
            if (navigator.share) {
                await navigator.share(shareData);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareData.url);
                alert('Link copied to clipboard.');
            }
        } catch (e) {
            console.error('Share error', e);
        }
    };

    const [showFullscreen, setShowFullscreen] = useState(false);
    // Multi-step expansions
    const [contentExpandStep, setContentExpandStep] = useState(0); // 0 = collapsed, 1..n = steps, reset to 0 after full
    const [detailsExpandStep, setDetailsExpandStep] = useState(0);
    const [sectionsExpanded, setSectionsExpanded] = useState(false);
    const [resultsExpanded, setResultsExpanded] = useState(false);

    // Charger les insights IA (résumé, mots-clés, liés)
    const loadAIInsights = async (rid) => {
        if (!rid) return;
        setAiLoading(true);
        try {
            const [s, k, r] = await Promise.all([
                axios.get(`/api/ai/resources/${rid}/summary`).catch(() => ({ data: { summary: '' } })),
                axios.get(`/api/ai/resources/${rid}/keywords`).catch(() => ({ data: { keywords: [] } })),
                axios.get(`/api/ai/resources/${rid}/related`).catch(() => ({ data: { related: [] } })),
            ]);
            setAiSummary(s.data?.summary || '');
            setAiKeywords(Array.isArray(k.data?.keywords) ? k.data.keywords.slice(0, 10) : []);
            setAiRelated(Array.isArray(r.data?.related) ? r.data.related : []);
        } finally {
            setAiLoading(false);
        }
    };

    useEffect(() => {
        if (resource?.id) {
            loadAIInsights(resource.id);
        }
    }, [resource?.id]);
    
    const exportToPdf = () => {
        setIsExporting(true);
        let element = document.getElementById('resource-content');
        // S'il n'y a pas de contenu riche, créer un contenu minimal pour l'export
        if (!element) {
            element = document.createElement('div');
            element.id = 'resource-content';
            element.innerHTML = `
                <h1>${resource.title || 'Resource'}</h1>
                ${resource.url ? `<p>Source: <a href="${resource.url}">${resource.url}</a></p>` : ''}
            `;
        }
        
        // Créer un clone de l'élément pour appliquer les styles spécifiques au PDF
        const elementClone = element.cloneNode(true);
        
        // Ajouter des styles spécifiques pour le PDF
        const style = document.createElement('style');
        style.textContent = `
            body { 
                color: #ffffff !important; 
                background: #ffffff !important;
                font-family: Arial, sans-serif;
                line-height: 1.6;
                padding: 20px;
            }
            .resource-content {
                color: #ffffff !important;
                background: #ffffff !important;
            }
            h1, h2, h3, h4, h5, h6 {
                color: #ffffff !important;
                margin: 15px 0 10px 0;
            }
            a {
                color: #1a73e8 !important;
                text-decoration: underline !important;
            }
            img {
                max-width: 100% !important;
                height: auto !important;
                margin: 10px 0;
                border: 1px solid #eee;
            }
            table {
                width: 100% !important;
                border-collapse: collapse !important;
                margin: 15px 0 !important;
            }
            th, td {
                border: 1px solid #ddd !important;
                padding: 8px !important;
                text-align: left !important;
            }
            th {
                background-color: #f2f2f2 !important;
            }
            pre, code {
                background-color: #f5f5f5 !important;
                padding: 5px;
                border-radius: 3px;
                font-family: monospace;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
        `;
        
        // Ajouter le style au clone
        elementClone.prepend(style);
        
        // Options pour le PDF
        const opt = {
            margin: [10, 15, 10, 15],
            filename: `${resource.title.replace(/[^\w\d]/g, '_')}.pdf`,
            image: { 
                type: 'jpeg', 
                quality: 0.98 
            },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'portrait'
            }
        };
        
        // Créer un conteneur temporaire
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.appendChild(elementClone);
        document.body.appendChild(tempContainer);
        
        // Générer le PDF
        html2pdf()
            .set(opt)
            .from(elementClone)
            .save()
            .then(() => {
                // Nettoyer
                document.body.removeChild(tempContainer);
            })
            .catch(error => {
                console.error('Error generating PDF:', error);
                setError('Error generating PDF.');
            })
            .finally(() => {
                setIsExporting(false);
            });
    };
    
    const exportToWord = async () => {
        setIsExporting(true);
        
        try {
            // Créer un tableau de paragraphes pour le document Word
            const paragraphs = [];
            
            // Ajouter le titre
            paragraphs.push(
                new Paragraph({
                    text: resource.title,
                    heading: "Heading1",
                    spacing: { after: 200 }
                })
            );
            
            // Ajouter la source
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'Source: ',
                            bold: true
                        }),
                        new TextRun({
                            text: resource.url,
                            style: 'Hyperlink',
                            color: '0563C1',
                            underline: {}
                        })
                    ]
                })
            );
            
            // Ajouter un saut de ligne
            paragraphs.push(new Paragraph({}));
            
            // Créer un élément DOM pour parser le contenu HTML
            const parser = new DOMParser();
            const safeContent = resource.content ? resource.content : '';
            const doc = parser.parseFromString(`<div>${safeContent}</div>`, 'text/html');
            
            // Fonction pour traiter les nœuds
            const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.textContent.trim() ? node.textContent : null;
                }
                
                const tagName = node.tagName ? node.tagName.toLowerCase() : '';
                const children = Array.from(node.childNodes);
                
                // Traiter les éléments spécifiques
                if (tagName === 'img') {
                    const src = node.getAttribute('src');
                    const alt = node.getAttribute('alt') || 'Image';
                    return new Paragraph({
                        children: [
                            new TextRun({
                                text: `[${alt}]`,
                                color: '666666',
                                italic: true
                            })
                        ],
                        alignment: 'center'
                    });
                }
                
                if (tagName === 'a') {
                    const text = node.textContent || '';
                    const href = node.getAttribute('href') || '';
                    return new Paragraph({
                        children: [
                            new TextRun({
                                text: text + ' ',
                                style: 'Hyperlink',
                                color: '0563C1',
                                underline: {}
                            }),
                            new TextRun({
                                text: `(${href})`,
                                color: '666666',
                                size: 20
                            })
                        ]
                    });
                }
                
                // Gestion des titres
                if (tagName.match(/^h[1-6]$/)) {
                    const level = parseInt(tagName.charAt(1));
                    return new Paragraph({
                        text: node.textContent,
                        heading: `Heading${Math.min(level, 3)}`,
                        spacing: { before: 200, after: 100 }
                    });
                }
                
                // Gestion des paragraphes
                if (tagName === 'p') {
                    return new Paragraph({
                        text: node.textContent,
                        spacing: { after: 100 }
                    });
                }
                
                // Gestion des listes
                if (tagName === 'ul' || tagName === 'ol') {
                    const listItems = [];
                    node.querySelectorAll('li').forEach((item, index) => {
                        listItems.push(
                            new Paragraph({
                                text: (tagName === 'ol' ? `${index + 1}. ` : '• ') + item.textContent,
                                indent: { left: 400 },
                                spacing: { after: 50 }
                            })
                        );
                    });
                    return listItems;
                }
                
                // Pour les autres éléments, traiter les enfants
                const childrenContent = children
                    .map(processNode)
                    .filter(Boolean)
                    .flat();
                    
                return childrenContent.length > 0 ? childrenContent : null;
            };
            
            // Traiter le contenu du document
            const content = Array.from(doc.body.firstChild.childNodes)
                .map(processNode)
                .filter(Boolean)
                .flat();
            
            // Ajouter le contenu aux paragraphes
            paragraphs.push(...content);
            
            // Créer le document Word
            const docx = new Document({
                styles: {
                    paragraphStyles: [
                        {
                            id: 'Normal',
                            name: 'Normal',
                            run: {
                                size: 24, // 12pt
                                font: 'Arial'
                            },
                            paragraph: {
                                spacing: { line: 276, before: 100, after: 100 },
                            },
                        },
                    ],
                },
                sections: [{
                    properties: {},
                    children: paragraphs.flat(Infinity).filter(Boolean)
                }]
            });
            
            // Générer le fichier Word
            const blob = await Packer.toBlob(docx);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${resource.title.replace(/[^\w\d]/g, '_')}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Error exporting to Word:', error);
            setError('Error exporting to Word');
        } finally {
            setIsExporting(false);
        }
    };
    
    if (isLoading || isExporting) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">{isExporting ? 'Exporting...' : 'Loading...'}</span>
                </Spinner>
            </div>
        );
    }

    if (error || !resource) {
        return (
            <Alert variant="danger" className="m-4">
                {error || 'Resource not found'}
            </Alert>
        );
    }

    return (
        <Container className="py-4 py-md-5">
            {/* Bloc 1: En-tête Mission avec Share / Explore */}
            <div className="mb-3 d-flex align-items-center gap-2">
                <div className="flex-grow-1">
                    <h1 className="h4 mb-0">{mission?.collection || 'All Missions'}</h1>
                    <div className="text-muted small">{mission?.name ? mission.name : missionName}</div>
                </div>
                <div className="d-flex gap-2">
                    <Button variant="outline-secondary" onClick={handleShare}>Share</Button>
                    <Button variant="primary" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
                        Explore
                    </Button>
                </div>
            </div>

            {/* Bloc 2: Bandeau infos (nom mission, années, vols, focus) */}
            <Card className="mb-3 shadow-sm">
                <Card.Body>
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div>
                            <h2 className="h5 mb-1">{missionName}</h2>
                            <div className="d-flex flex-wrap gap-2">
                                {missionFlights != null && (
                                    <Badge bg="dark">Flights {missionFlights}</Badge>
                                )}
                                {missionYears && (
                                    <Badge bg="secondary">Years {missionYears}</Badge>
                                )}
                                {missionFocus && (
                                    <Badge bg="info" text="dark">Focus {missionFocus}</Badge>
                                )}
                            </div>
                        </div>
                        {linkInfo.host && (
                            <Badge bg="secondary">{linkInfo.host}</Badge>
                        )}
                    </div>

                    {/* Filtres */}
                    <div className="mt-3">
                        <Row className="g-2 align-items-end">
                            <Col md={3}>
                                <Form.Label className="small text-white">Timeframe</Form.Label>
                                <Form.Control
                                    size="sm"
                                    value={filters.timeframe}
                                    onChange={(e) => setFilters({ ...filters, timeframe: e.target.value })}
                                    placeholder="ex: 1966–1975"
                                />
                            </Col>
                            <Col md={3}>
                                <Form.Label className="small text-white">Experiment type</Form.Label>
                                <Form.Select size="sm" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                                    <option>All</option>
                                    <option>Biology</option>
                                    <option>Radiation</option>
                                    <option>Plant</option>
                                </Form.Select>
                            </Col>
                            <Col md={3}>
                                <Form.Label className="small text-white">Organisms</Form.Label>
                                <Form.Select size="sm" value={filters.organism} onChange={(e) => setFilters({ ...filters, organism: e.target.value })}>
                                    <option>All</option>
                                    <option>Human</option>
                                    <option>Mouse</option>
                                    <option>Plant</option>
                                    <option>Microbe</option>
                                </Form.Select>
                            </Col>
                            <Col md={3}>
                                <Form.Label className="small text-white">Search within...</Form.Label>
                                <InputGroup size="sm">
                                    <Form.Control
                                        value={filters.query}
                                        onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                                        placeholder="Rechercher"
                                    />
                                    <Button variant="outline-secondary" onClick={() => setFilters({ ...filters, query: '' })}>Reset</Button>
                                </InputGroup>
                            </Col>
                        </Row>
                    </div>

                    {/* Stat Cards (réactifs aux filtres) */}
                    <Row className="g-3 mt-3 text-white">
                        <Col md={4}>
                            <Card className="h-100">
                                <Card.Body>
                                    <div className="small">Experiments</div>
                                    <div className="display-6">{(statExperiments ?? undefined) ?? filtered.experiments.length}</div>
                                    <div className="small">Mini trend</div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4}>
                            <Card className="h-100">
                                <Card.Body>
                                    <div className="small">Publications</div>
                                    <div className="display-6">{(statPublications ?? undefined) ?? filtered.publications.length}</div>
                                    <div className="small">Mini trend</div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={4}>
                            <Card className="h-100">
                                <Card.Body>
                                    <div className="small">Organisms</div>
                                    <div className="display-6">{(statOrganisms ?? undefined) ?? filtered.organisms.length}</div>
                                    <div className="small">Mini trend</div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Bloc 3: Corps principal deux colonnes */}
            <Row className="g-4">
                <Col lg={8}>
                    <div className="card shadow-sm h-100">
                        <div className="card-body p-4">
                            <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                                <div>
                                    <h1 className="h3 mb-2 text-break">{resource.title}</h1>
                                    <div className="d-flex flex-wrap gap-2">
                                        <Badge bg="info" text="dark" className="d-inline-flex align-items-center">
                                            <LinkTypeIcon type={linkInfo.type} className="me-1" /> {linkInfo.type.toUpperCase()}
                                        </Badge>
                                        {resource.publication_date && (
                                            <Badge bg="dark">{new Date(resource.publication_date).toLocaleDateString()}</Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="d-flex gap-2 flex-wrap">
                                    <a
                                        href={resource.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary d-inline-flex align-items-center"
                                    >
                                        <BoxArrowUpRight className="me-2" /> Open
                                    </a>
                                    <Dropdown>
                                        <Dropdown.Toggle variant="secondary" id="dropdown-export">
                                            <Download className="me-2" /> Export
                                        </Dropdown.Toggle>
                                        <Dropdown.Menu>
                                            <Dropdown.Item onClick={() => exportToPdf()}>
                                                <FileEarmarkPdf className="me-2" /> Download PDF
                                            </Dropdown.Item>
                                            <Dropdown.Item onClick={() => exportToWord()}>
                                                <FileEarmarkWord className="me-2" /> Download Word
                                            </Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown>
                                </div>
                            </div>

                            {/* Aperçu inline lorsque possible */}
                            {(linkInfo.type === 'pdf' || linkInfo.type === 'video' || linkInfo.type === 'image') && (
                                <div className="mb-4">
                                    {linkInfo.type === 'pdf' && (
                                        <div className="ratio ratio-16x9 border rounded overflow-hidden">
                                            <iframe
                                                title="pdf"
                                                src={`https://docs.google.com/gview?url=${encodeURIComponent(resource.url)}&embedded=true`}
                                                frameBorder="0"
                                            />
                                        </div>
                                    )}
                                    {linkInfo.type === 'video' && (
                                        <div className="ratio ratio-16x9 border rounded overflow-hidden">
                                            <iframe
                                                title="video"
                                                src={resource.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/')}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                allowFullScreen
                                            />
                                        </div>
                                    )}
                                    {linkInfo.type === 'image' && (
                                        <img src={resource.url} alt={resource.title} className="img-fluid rounded border" />
                                    )}
                                </div>
                            )}

                            {resource.content && (
                                <div className="mt-2">
                                    <h2 className="h5 mb-3">Contenu de la ressource</h2>
                                    <div id="resource-content">
                                        <h1 className="h4">{resource.title}</h1>
                                        <p>
                                            Source: {' '}
                                            <a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.url}</a>
                                        </p>
                                        <div className="position-relative">
                                            <div
                                                className="border rounded p-3 resource-content"
                                                style={{
                                                    maxHeight: contentExpandStep >= 3 ? 'none' : ['320px','640px','960px'][contentExpandStep] || '320px',
                                                    overflow: 'hidden'
                                                }}
                                                dangerouslySetInnerHTML={{ __html: contentWithAnchors || resource.content }}
                                                ref={contentRef}
                                            />
                                            {contentExpandStep < 3 && (
                                                <div
                                                    className="position-absolute start-0 end-0"
                                                    style={{ height: '80px', bottom: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, var(--bs-body-bg, #fff) 80%)' }}
                                                />
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <Button
                                                size="sm"
                                                variant="outline-secondary"
                                                onClick={() => setContentExpandStep(step => (step >= 3 ? 0 : step + 1))}
                                            >
                                                {contentExpandStep >= 3 ? 'See less' : 'See more'}
                                            </Button>
                                        </div>
                                        <div className="text-end mt-3">
                                            <Button size="sm" variant="outline-primary" onClick={() => setShowFullscreen(true)}>
                                                See fullscreen
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Col>
                <Col lg={4}>
                    <div className="card shadow-sm h-100">
                        <div className="card-body p-4">
                            <h3 className="h5 mb-3" style={{ color: 'white' }}>Détails</h3>
                            {/* Wrapper collapsible for details column */}
                            <div className="position-relative">
                            <div
                                style={{
                                    maxHeight: detailsExpandStep >= 3 ? 'none' : ['260px','520px','780px'][detailsExpandStep] || '260px',
                                    overflow: 'hidden'
                                }}
                            >
                            <dl className="row mb-0">
                                <dt className="col-5" style={{ color: 'white' }}>Type</dt>
                                <dd className="col-7 text-capitalize" style={{ color: 'white' }}>{linkInfo.type}</dd>

                                {linkInfo.host && (
                                    <>
                                        <dt className="col-5" style={{ color: 'white' }}>Domain</dt>
                                        <dd className="col-7" style={{ color: 'white' }}>{linkInfo.host}</dd>
                                    </>
                                )}

                                <dt className="col-5" style={{ color: 'white' }}>URL</dt>
                                <dd className="col-7">
                                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-break d-inline-flex align-items-center">
                                        <LinkTypeIcon type={linkInfo.type} className="me-1" />
                                        {resource.url}
                                    </a>
                                </dd>

                                {Array.isArray(resource.authors) && resource.authors.length > 0 && (
                                    <>
                                        <dt className="col-5" style={{ color: 'white' }}>Authors</dt>
                                        <dd className="col-7" style={{ color: 'white' }}>{resource.authors.join(', ')}</dd>
                                    </>
                                )}

                                {resource.publication_date && (
                                    <>
                                        <dt className="col-5" style={{ color: 'white' }}>Published on</dt>
                                        <dd className="col-7" style={{ color: 'white' }}>{new Date(resource.publication_date).toLocaleDateString()}</dd>
                                    </>
                                )}

                                {resource.keywords && resource.keywords.length > 0 && (
                                    <>
                                        <dt className="col-5" style={{ color: 'white' }}>Keywords</dt>
                                        <dd className="col-7" style={{ color: 'white' }}>
                                            <div className="d-flex flex-wrap gap-1">
                                                {resource.keywords.map((k, i) => (
                                                    <Badge bg="light" text="white" key={i}>{k}</Badge>
                                                ))}
                                            </div>
                                        </dd>
                                    </>
                                )}
                            </dl>
                            {/* Liste de paragraphes/sections (sommaire simple) */}
                            {filtered.sections.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="h6" style={{ color: 'white' }}>Sections</h3>
                                    <div className="small text-muted" style={{ color: 'white' }}>{filtered.sections.length} Elements</div>
                                    <ul className="mt-2 ps-3" style={{ color: 'white' }}>
                                        {(sectionsExpanded ? filtered.sections : filtered.sections.slice(0, 8)).map(s => (
                                            <li key={s.id} className="mb-1">
                                                <Button variant="link" size="sm" className="p-0 text-start" onClick={() => scrollToSection(s.id)}>
                                                    {s.text.length > 110 ? s.text.slice(0, 110) + '…' : s.text}
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                    {filtered.sections.length > 8 && (
                                        <Button size="sm" variant="outline-secondary" onClick={() => setSectionsExpanded(v => !v)}>
                                            {sectionsExpanded ? 'See less' : 'See more'}
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Résultats filtrés: expériences et publications */}
                            <div className="mt-4">
                                <h3 className="h6">Results</h3>
                                <div className="small text-muted mb-2">
                                    {filtered.experiments.length} Experiments · {filtered.publications.length} Publications · {filtered.organisms.length} Organisms
                                </div>
                                {filtered.experiments.length > 0 && (
                                    <div className="mb-3">
                                        <div className="fw-semibold small text-uppercase text-muted">Experiments</div>
                                        <ul className="mt-1 ps-3">
                                            {(resultsExpanded ? filtered.experiments : filtered.experiments.slice(0, 5)).map((e, i) => (
                                                <li key={e.id || i} className="mb-1">{e.title || e.text || 'Experiment'}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {filtered.publications.length > 0 && (
                                    <div className="mb-2">
                                        <div className="fw-semibold small text-uppercase text-muted">Publications</div>
                                        <ul className="mt-1 ps-3">
                                            {(resultsExpanded ? filtered.publications : filtered.publications.slice(0, 5)).map((p, i) => (
                                                <li key={p.id || i} className="mb-1">
                                                    {p.url ? (
                                                        <a href={p.url} target="_blank" rel="noopener noreferrer">{p.title || p.url}</a>
                                                    ) : (
                                                        p.title || 'Publication'
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {(filtered.experiments.length > 5 || filtered.publications.length > 5) && (
                                    <div className="mt-2">
                                        <Button size="sm" variant="outline-secondary" onClick={() => setResultsExpanded(v => !v)}>
                                            {resultsExpanded ? 'See less' : 'See more'}
                                        </Button>
                                    </div>
                                )}
                            </div>{/* end results */}
                            </div>{/* end overflow limiter */}
                            </div>{/* end position-relative */}
                            <div className="mt-2">
                                <Button
                                    size="sm"
                                    variant="outline-secondary"
                                    onClick={() => setDetailsExpandStep(step => (step >= 3 ? 0 : step + 1))}
                                >
                                    {detailsExpandStep >= 3 ? 'See less' : 'See more'}
                                </Button>
                            </div>
                        </div>{/* end card-body */}
                    </div>{/* end card */}
                </Col>
            </Row>

            {/* Bloc 4: Partenaires et missions liées */}
            {(partners.length > 0 || relatedMissions.length > 0) && (
                <Row className="g-4 mt-4">
                    {partners.length > 0 && (
                        <Col md={6}>
                            <Card className="shadow-sm h-100">
                                <Card.Body>
                                    <h2 className="h5 mb-3">Partners</h2>
                                    <div className="d-flex flex-wrap gap-2">
                                        {partners.map((p, i) => (
                                            <Badge key={i} bg="light" text="dark">{p}</Badge>
                                        ))}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    )}
                    {relatedMissions.length > 0 && (
                        <Col md={6}>
                            <Card className="shadow-sm h-100">
                                <Card.Body>
                                    <h2 className="h5 mb-3">Related missions</h2>
                                    <ul className="mb-0">
                                        {relatedMissions.map((m, i) => (
                                            <li key={i} className="mb-1">{typeof m === 'string' ? m : (m.name || JSON.stringify(m))}</li>
                                        ))}
                                    </ul>
                                </Card.Body>
                            </Card>
                        </Col>
                    )}
                </Row>
            )}

            {/* Modal plein écran pour le contenu */}
            <Modal show={showFullscreen} onHide={() => setShowFullscreen(false)} fullscreen>
                <Modal.Header closeButton>
                    <Modal.Title>{resource?.title || 'Content'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div dangerouslySetInnerHTML={{ __html: resource?.content || '<p>No content available.</p>' }} />
                </Modal.Body>
            </Modal>
        </Container>
    );
};

export default ResourceDetailsPage;

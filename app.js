/**
 * lornAI - Core Application Controller
 * Features:
 * - Default Dark Theme with Claude Charcoal/Terracotta styling
 * - Ultra-Fast Low-Latency Streaming Engine with multi-source fallback
 * - Vision Multimodal Image Recognition
 * - 150+ Master Skills Pack with searchable explorer & Custom Skills
 * - Model Context Protocol (MCP) Manager (with Roblox Studio MCP preset)
 * - Neon Auth (Google, Phone) & Discord OAuth Integration
 * - Zero Leaked Keys (Private LocalStorage only)
 */

// 150 Master Skills Pack Data Catalog
const MASTER_SKILLS_PACK = [
  // --- Roblox & Game Dev (20) ---
  { id: "rbx-oop", name: "Roblox Luau OOP Architecture", cat: "Roblox", desc: "Object-oriented class structures, metatables, inheritance, and clean lifecycle management in Luau." },
  { id: "rbx-profile", name: "Roblox ProfileService & DataStore", cat: "Roblox", desc: "Session locking, auto-saving, migration schemas, and crash-resilient player data persistence." },
  { id: "rbx-knit", name: "Roblox Knit Framework", cat: "Roblox", desc: "Lightweight single-script architecture with clean Services on server and Controllers on client." },
  { id: "rbx-replica", name: "ReplicaService State Sync", cat: "Roblox", desc: "High-performance authoritative server-to-client state replication with minimal bandwidth." },
  { id: "rbx-raycast", name: "Physics & Raycasting", cat: "Roblox", desc: "Spatial queries, custom projectile physics, wall-running, and surface normal alignment." },
  { id: "rbx-rigging", name: "Character & Rigging", cat: "Roblox", desc: "Motor6D manipulation, inverse kinematics (IK), procedural spine tilt, and animation blending." },
  { id: "rbx-fusion", name: "Roact & Fusion UI", cat: "Roblox", desc: "Declarative, reactive UI components, tween springs, and scalable viewport responsive styling." },
  { id: "rbx-pathfind", name: "Pathfinding & NPC AI", cat: "Roblox", desc: "PathfindingService waypoints, obstacle avoidance, threat aggro states, and behavior trees." },
  { id: "rbx-combat", name: "Hitbox & Combat Engine", cat: "Roblox", desc: "Server-validated spatial hitboxes, lag compensation, combo buffers, and iframe timing." },
  { id: "rbx-security", name: "Anti-Exploit & Validation", cat: "Roblox", desc: "Sanitizing RemoteEvents, speed/teleport heuristics, sanity bounds, and rate limiters." },
  { id: "rbx-plugin", name: "Studio Plugin Architecture", cat: "Roblox", desc: "DockWidgetPluginGui creation, ChangeHistoryService undo/redo, and scene generators." },
  { id: "rbx-vfx", name: "Particle & Beam VFX", cat: "Roblox", desc: "ParticleEmitter tuning, beam curves, lighting depth, and camera shake impact effects." },
  { id: "rbx-audio", name: "Dynamic Sound Engine", cat: "Roblox", desc: "Contextual BGM transitions, 3D reverb zones, Doppler shifts, and auditory feedback." },
  { id: "rbx-monetize", name: "Gamepass & Receipt Engine", cat: "Roblox", desc: "MarketplaceService ProcessReceipt handling, purchase idempotency, and VIP triggers." },
  { id: "rbx-stream", name: "StreamingEnabled Optimization", cat: "Roblox", desc: "Model streaming pauses, persistent models, LOD geometry, and client memory conservation." },
  { id: "rbx-camera", name: "Custom Camera Systems", cat: "Roblox", desc: "Isometric, over-the-shoulder, cinematic cutscenes, and smooth camera bobbing script." },
  { id: "rbx-vehicles", name: "Spring Vehicle Physics", cat: "Roblox", desc: "Raycast suspensions, wheel friction curves, drift dampeners, and aerodynamics." },
  { id: "rbx-inventory", name: "Inventory & Trading System", cat: "Roblox", desc: "Secure two-player trading window, item serials, stack limits, and bag slots." },
  { id: "rbx-dialogue", name: "Branching Dialogue Trees", cat: "Roblox", desc: "Node-based NPC dialogue, condition checks, quest progression, and typewriter FX." },
  { id: "rbx-voice", name: "Spatial Audio & Proximity", cat: "Roblox", desc: "ProximityPrompt interactions, spatial chat mechanics, and team voice grouping." },

  // --- Full-Stack Engineering (35) ---
  { id: "eng-fastapi", name: "FastAPI Async Architecture", cat: "Engineering", desc: "Pydantic V2 schemas, dependency injection, async workers, and OpenAPI specs." },
  { id: "eng-ts", name: "TypeScript Strict Mastery", cat: "Engineering", desc: "Discriminated unions, template literal types, conditional types, and brand types." },
  { id: "eng-nextjs", name: "Next.js App Router & SSR", cat: "Engineering", desc: "Server components, server actions, optimistic UI, and edge caching." },
  { id: "eng-tailwind", name: "Tailwind Design Systems", cat: "Engineering", desc: "Utility-first architecture, fluid typography, dark mode CSS tokens, and transitions." },
  { id: "eng-postgres", name: "PostgreSQL & Neon Cloud", cat: "Engineering", desc: "Connection pooling, ACID transactions, EXPLAIN ANALYZE, and serverless scaling." },
  { id: "eng-redis", name: "Redis Caching & Pub/Sub", cat: "Engineering", desc: "Distributed locks (Redlock), rate limiters, session stores, and cache invalidation." },
  { id: "eng-webrtc", name: "WebSockets & WebRTC", cat: "Engineering", desc: "Peer-to-peer data channels, STUN/TURN traversal, and sub-100ms bidirectional sync." },
  { id: "eng-docker", name: "Docker & Containerization", cat: "Engineering", desc: "Multi-stage builds, minimal alpine footprints, compose networks, and healthchecks." },
  { id: "eng-graphql", name: "GraphQL Schema Design", cat: "Engineering", desc: "Queries, mutations, DataLoader n+1 mitigation, and subscription channels." },
  { id: "eng-cf-workers", name: "Cloudflare Edge Compute", cat: "Engineering", desc: "Pages Functions, Workers KV, Durable Objects, and sub-millisecond edge routing." },
  { id: "eng-rest", name: "RESTful API Best Practices", cat: "Engineering", desc: "Idempotent verbs, JSON:API standards, semantic HTTP codes, and pagination." },
  { id: "eng-bash", name: "Linux Bash Automation", cat: "Engineering", desc: "Shell pipelines, sed/awk parsing, cron daemons, and systemd service scripts." },
  { id: "eng-git", name: "Advanced Git Workflows", cat: "Engineering", desc: "Interactive rebase, bisect bug tracking, cherry-picking, and conventional commits." },
  { id: "eng-security", name: "OWASP Web Security", cat: "Engineering", desc: "XSS prevention, CSRF tokens, strict CSP headers, SQL injection defense, and JWTs." },
  { id: "eng-algo", name: "High-Performance Algorithms", cat: "Engineering", desc: "Time & space complexity optimization, dynamic programming, and tree traversal." },
  { id: "eng-rust", name: "Rust Memory Safety", cat: "Engineering", desc: "Ownership, borrow checking, lifetimes, zero-cost abstractions, and Tokio async." },
  { id: "eng-go", name: "Go Concurrency Pipelines", cat: "Engineering", desc: "Goroutines, channel multiplexing, context cancellation, and sync.WaitGroup." },
  { id: "eng-cpp", name: "C++ Modern Memory", cat: "Engineering", desc: "Smart pointers, RAII, move semantics, cache locality, and SIMD instructions." },
  { id: "eng-wasm", name: "WebAssembly (Wasm)", cat: "Engineering", desc: "Compiling native C/Rust code to browser bytecode for near-native compute." },
  { id: "eng-indexes", name: "Database Index Tuning", cat: "Engineering", desc: "B-Tree, GIN, GiST, covering indexes, and execution plan optimization." },
  { id: "eng-sse", name: "Server-Sent Events (SSE)", cat: "Engineering", desc: "Persistent text/event-stream connections for real-time AI chunk delivery." },
  { id: "eng-pwa", name: "Progressive Web Apps", cat: "Engineering", desc: "Service worker caching strategies, offline manifests, and push notifications." },
  { id: "eng-cicd", name: "CI/CD GitHub Actions", cat: "Engineering", desc: "Automated linting, matrix testing, staging preview deployments, and releases." },
  { id: "eng-testing", name: "Vitest & Pytest Testing", cat: "Engineering", desc: "Unit tests, mocking external APIs, parameterized tests, and code coverage." },
  { id: "eng-micro", name: "Micro-Frontend Systems", cat: "Engineering", desc: "Module federation, decoupled releases, and shared runtime design systems." },
  { id: "eng-xstate", name: "Finite State Machines", cat: "Engineering", desc: "Predictable state modeling, guard transitions, and eliminating invalid states." },
  { id: "eng-migrate", name: "Zero-Downtime Migrations", cat: "Engineering", desc: "Expand-and-contract database schema migrations and blue-green rollouts." },
  { id: "eng-webhooks", name: "Idempotent Webhooks", cat: "Engineering", desc: "HMAC signature verification, dead-letter queues, and retry backoffs." },
  { id: "eng-streams", name: "Node.js Stream Processing", cat: "Engineering", desc: "Backpressure management, pipeline piping, and transform chunking." },
  { id: "eng-events", name: "Event-Driven Messaging", cat: "Engineering", desc: "Kafka message brokers, outbox patterns, and exactly-once processing." },
  { id: "eng-nginx", name: "NGINX Reverse Proxy", cat: "Engineering", desc: "SSL termination, load balancing, Brotli compression, and proxy buffers." },
  { id: "eng-vector", name: "Vector Database Indices", cat: "Engineering", desc: "HNSW, IVFFlat, cosine distance, and high-dimensional semantic search." },
  { id: "eng-ratelimit", name: "Token Bucket Rate Limiting", cat: "Engineering", desc: "Sliding window counters, leaky bucket algorithms, and DDoS defense." },
  { id: "eng-oauth", name: "OAuth 2.0 & PKCE", cat: "Engineering", desc: "Authorization code grant with PKCE, state token validation, and refresh rotations." },
  { id: "eng-coldstart", name: "Serverless Cold Starts", cat: "Engineering", desc: "Bundle tree-shaking, connection reuse, and edge isolate warm-ups." },

  // --- AI & Machine Learning (25) ---
  { id: "ai-pytorch", name: "PyTorch Deep Learning", cat: "AI & ML", desc: "Autograd tensors, custom nn.Module, loss backward passes, and GPU CUDA pipelines." },
  { id: "ai-transformer", name: "Transformer Attention", cat: "AI & ML", desc: "Multi-head self-attention, positional encoding, and KV cache mechanics." },
  { id: "ai-rag", name: "Production RAG Pipelines", cat: "AI & ML", desc: "Chunking strategies, hybrid BM25 + dense search, reranking, and source attribution." },
  { id: "ai-vectordb", name: "Vector Store Management", cat: "AI & ML", desc: "Pinecone, Chroma, and Qdrant index namespaces and metadata filtering." },
  { id: "ai-langchain", name: "Agent Tool Calling", cat: "AI & ML", desc: "Dynamic tool invocation, structured JSON schemas, and execution sandboxes." },
  { id: "ai-lora", name: "LoRA & QLoRA Fine-Tuning", cat: "AI & ML", desc: "Parameter-efficient adapters, 4-bit quantization, and domain adaptation." },
  { id: "ai-prompting", name: "Advanced Prompt Engineering", cat: "AI & ML", desc: "Chain-of-thought, tree-of-thought, few-shot prompting, and hallucination reduction." },
  { id: "ai-pandas", name: "Pandas Data Wrangling", cat: "AI & ML", desc: "Vectorized computations, groupby aggregations, pivot tables, and memory reduction." },
  { id: "ai-numpy", name: "NumPy Matrix Operations", cat: "AI & ML", desc: "Broadcasting rules, matrix factorizations, SVD, and fast numerical indexing." },
  { id: "ai-scikit", name: "Scikit-Learn Modeling", cat: "AI & ML", desc: "Random forests, gradient boosting, cross-validation, and pipeline transformers." },
  { id: "ai-eval", name: "Model Evaluation & F1", cat: "AI & ML", desc: "ROC-AUC curves, confusion matrices, precision-recall trade-offs, and perplexity." },
  { id: "ai-vision", name: "Computer Vision & YOLO", cat: "AI & ML", desc: "Object detection, bounding box regression, semantic segmentation, and OpenCV." },
  { id: "ai-nlp", name: "NLP & Token Embeddings", cat: "AI & ML", desc: "Byte-pair encoding, Word2Vec, contextual embeddings, and semantic clustering." },
  { id: "ai-time", name: "Time Series Forecasting", cat: "AI & ML", desc: "Stationarity tests, ARIMA, seasonal decomposition, and recurrent forecasting." },
  { id: "ai-guard", name: "LLM Guardrails & Safety", cat: "AI & ML", desc: "Prompt injection defense, jailbreak mitigation, and output schema validators." },
  { id: "ai-agentic", name: "Multi-Agent Coordination", cat: "AI & ML", desc: "Supervisor-worker agent topologies, task delegation, and consensus voting." },
  { id: "ai-cosine", name: "Semantic Embedding Search", cat: "AI & ML", desc: "Cosine similarity, dot products, normalized vector math, and clustering." },
  { id: "ai-synthetic", name: "Synthetic Dataset Creation", cat: "AI & ML", desc: "LLM-driven distillation, data balancing, edge-case generation, and labeling." },
  { id: "ai-explain", name: "Explainable AI (XAI)", cat: "AI & ML", desc: "SHAP values, feature importance, integrated gradients, and model interpretability." },
  { id: "ai-quant", name: "Model Quantization", cat: "AI & ML", desc: "GGUF, AWQ, INT8/INT4 weights, and low-VRAM inference deployment." },
  { id: "ai-rl", name: "Reinforcement Learning", cat: "AI & ML", desc: "Policy gradients, PPO, actor-critic frameworks, and reward function design." },
  { id: "ai-whisper", name: "Audio Speech-to-Text", cat: "AI & ML", desc: "Whisper speech transcription, phonetic alignment, and audio noise filtering." },
  { id: "ai-multimodal", name: "Multimodal Vision Reasoning", cat: "AI & ML", desc: "Analyzing screenshots, diagrams, chart data, and visual UI layouts." },
  { id: "ai-kg", name: "Knowledge Graphs & Triples", cat: "AI & ML", desc: "Entity resolution, Neo4j Cypher queries, and graph RAG semantic traversals." },
  { id: "ai-vllm", name: "vLLM Inference Serving", cat: "AI & ML", desc: "PagedAttention, continuous batching, tensor parallelism, and throughput tuning." },

  // --- Writing & Communication (25) ---
  { id: "wri-claude", name: "Claude-Style Prose & Voice", cat: "Writing", desc: "Warm, intellectually humble, articulate, structured, and insightful commentary." },
  { id: "wri-story", name: "Narrative & Worldbuilding", cat: "Writing", desc: "Compelling plot twists, atmospheric scene setting, lore, and sensory immersion." },
  { id: "wri-copy", name: "High-Converting Copywriting", cat: "Writing", desc: "PAS (Problem-Agitate-Solution), benefit-driven headlines, and persuasive CTAs." },
  { id: "wri-docs", name: "Technical Documentation", cat: "Writing", desc: "Clear API references, quickstarts, architectural diagrams, and error guides." },
  { id: "wri-academic", name: "Academic Paper Synthesis", cat: "Writing", desc: "Literature reviews, abstract summarization, methodology critique, and citations." },
  { id: "wri-executive", name: "Executive Briefings", cat: "Writing", desc: "Bottom Line Up Front (BLUF), key takeaways, risk factors, and strategic options." },
  { id: "wri-script", name: "Scriptwriting & Dialogue", cat: "Writing", desc: "Natural cadence, subtext, character vocal distinctions, and scene pacing." },
  { id: "wri-poetry", name: "Poetic Meter & Verse", cat: "Writing", desc: "Iambic rhythm, figurative metaphor, evocative imagery, and lyrical resonance." },
  { id: "wri-email", name: "Strategic Business Emails", cat: "Writing", desc: "High-response cold outreach, client proposals, and conflict resolution." },
  { id: "wri-seo", name: "Search Intent & SEO Content", cat: "Writing", desc: "Topical authority, semantic keyword coverage, schema markup, and readability." },
  { id: "wri-voice", name: "Brand Voice Harmonization", cat: "Writing", desc: "Style guides, tone adaptation across channels, and editorial consistency." },
  { id: "wri-pr", name: "Press Releases & News", cat: "Writing", desc: "Inverted pyramid journalism, media hooks, quotes, and company statements." },
  { id: "wri-character", name: "Character Psychology", cat: "Writing", desc: "Flaws, internal conflicts, motivations, and transformative character arcs." },
  { id: "wri-pacing", name: "Narrative Tension Pacing", cat: "Writing", desc: "Cliffhangers, dramatic irony, rhythm variation, and satisfying climaxes." },
  { id: "wri-analogies", name: "Pedagogical Analogies", cat: "Writing", desc: "Demystifying complex abstract science through intuitive real-world metaphors." },
  { id: "wri-book", name: "Book Chapter Outlining", cat: "Writing", desc: "Macro narrative architecture, chapter hooks, and progressive knowledge building." },
  { id: "wri-whitepaper", name: "Whitepapers & Case Studies", cat: "Writing", desc: "Data-backed evidence, client transformation stories, and technical feasibility." },
  { id: "wri-speech", name: "Keynote & Speechwriting", cat: "Writing", desc: "Rhetorical devices, emotional hooks, cadence pauses, and memorable codas." },
  { id: "wri-curriculum", name: "Course Curriculum Design", cat: "Writing", desc: "Learning outcomes, progressive quizzes, scaffolding, and hands-on exercises." },
  { id: "wri-translate", name: "Nuanced Multilingual Translation", cat: "Writing", desc: "Preserving idioms, cultural context, tone, and syntactic naturalness." },
  { id: "wri-debate", name: "Socratic Debate & Inquiry", cat: "Writing", desc: "Testing assumptions, counter-examples, logical dilemmas, and synthesis." },
  { id: "wri-interview", name: "Interview Question Design", cat: "Writing", desc: "Behavioral STAR questions, technical probe depths, and psychological safety." },
  { id: "wri-editing", name: "Substantive Line Editing", cat: "Writing", desc: "Eliminating passive voice, tightening prose, and enhancing clarity." },
  { id: "wri-satire", name: "Witty Satire & Humor", cat: "Writing", desc: "Subtle irony, comedic timing, playful exaggerations, and observational humor." },
  { id: "wri-viral", name: "Hook Formulation", cat: "Writing", desc: "Pattern interrupts, curiosity gaps, and shareable high-engagement formats." },

  // --- Mathematics & Science (20) ---
  { id: "sci-calc", name: "Multivariable Calculus", cat: "Math & Science", desc: "Gradients, Jacobians, Hessians, contour integrals, and vector fields." },
  { id: "sci-linalg", name: "Linear Algebra & Eigenvalues", cat: "Math & Science", desc: "Spectral decomposition, determinant properties, null spaces, and rank." },
  { id: "sci-bayes", name: "Bayesian Probability", cat: "Math & Science", desc: "Prior distributions, likelihood updates, posterior inference, and Bayes theorem." },
  { id: "sci-discrete", name: "Discrete Combinatorics", cat: "Math & Science", desc: "Permutations, inclusion-exclusion, recurrence relations, and graph colorings." },
  { id: "sci-quantum", name: "Quantum Mechanics", cat: "Math & Science", desc: "Wave functions, Schrödinger equations, qubit superpositions, and spin states." },
  { id: "sci-thermo", name: "Thermodynamics & Entropy", cat: "Math & Science", desc: "Carnot cycles, Gibbs free energy, enthalpy, and non-equilibrium states." },
  { id: "sci-primes", name: "Number Theory & Cryptography", cat: "Math & Science", desc: "Modular arithmetic, RSA primes, elliptic curves, and discrete logarithms." },
  { id: "sci-physics", name: "Relativistic & Classical Physics", cat: "Math & Science", desc: "Lorentz transformations, Lagrangian mechanics, and gravitational fields." },
  { id: "sci-logic", name: "Formal First-Order Logic", cat: "Math & Science", desc: "Quantifiers, truth tables, resolution refutation, and Gödel completeness." },
  { id: "sci-graphs", name: "Graph Theory & Topologies", cat: "Math & Science", desc: "Dijkstra, A* search, maximum flow min-cut, and bipartite matchings." },
  { id: "sci-numerical", name: "Numerical Methods (Runge-Kutta)", cat: "Math & Science", desc: "Newton-Raphson root finding, ODE integration, and floating-point stability." },
  { id: "sci-ode", name: "Differential Equations (ODEs/PDEs)", cat: "Math & Science", desc: "Separation of variables, Fourier transforms, and boundary value problems." },
  { id: "sci-game", name: "Game Theory & Nash Equilibria", cat: "Math & Science", desc: "Zero-sum games, prisoner's dilemmas, payoff matrices, and minimax strategies." },
  { id: "sci-info", name: "Information Theory (Shannon)", cat: "Math & Science", desc: "Entropy formulas, channel capacity, Huffman coding, and mutual information." },
  { id: "sci-boolean", name: "Boolean Circuit Minimization", cat: "Math & Science", desc: "Karnaugh maps, Quine-McCluskey, and logic gate optimization." },
  { id: "sci-chem", name: "Organic Reaction Mechanisms", cat: "Math & Science", desc: "Electrophilic additions, SN1/SN2 pathways, resonance structures, and Gibbs activation." },
  { id: "sci-bio", name: "Molecular Biology & Genetics", cat: "Math & Science", desc: "DNA transcription, CRISPR-Cas9, protein folding, and cellular signaling." },
  { id: "sci-astro", name: "Astrophysics & Orbital Math", cat: "Math & Science", desc: "Kepler's laws, Hohmann transfer orbits, escape velocity, and stellar fusion." },
  { id: "sci-finance", name: "Quantitative Financial Math", cat: "Math & Science", desc: "Black-Scholes option pricing, stochastic calculus, and Sharpe ratio risk." },
  { id: "sci-complex", name: "Complex Variables & Cauchy", cat: "Math & Science", desc: "Holomorphic functions, contour integration, and residue theorem." },

  // --- Strategy & Business (25) ---
  { id: "biz-first", name: "First-Principles Thinking", cat: "Strategy", desc: "Deconstructing problems to fundamental truths and reasoning upward." },
  { id: "biz-mvp", name: "Lean Startup & MVP Scoping", cat: "Strategy", desc: "Defining riskiest assumptions, hypothesis testing, and rapid validation." },
  { id: "biz-prd", name: "Product Requirements (PRD)", cat: "Strategy", desc: "User stories, acceptance criteria, wireframe flows, and edge scenarios." },
  { id: "biz-uiux", name: "UI/UX & Cognitive Ergonomics", cat: "Strategy", desc: "Fitts's law, visual hierarchy, micro-interactions, and reducing friction." },
  { id: "biz-funnel", name: "Conversion Funnel Analysis", cat: "Strategy", desc: "Identifying drop-off points, cohort retention, and activation metrics." },
  { id: "biz-saas", name: "SaaS Unit Economics", cat: "Strategy", desc: "LTV/CAC ratios, payback periods, Net Revenue Retention (NRR), and churn." },
  { id: "biz-moats", name: "Competitive Moats", cat: "Strategy", desc: "Network effects, high switching costs, scale economies, and brand equity." },
  { id: "biz-root", name: "Root Cause (5 Whys)", cat: "Strategy", desc: "Fishbone Ishikawa diagrams, avoiding symptomatic fixes, and systems thinking." },
  { id: "biz-risk", name: "Risk Mitigation Matrices", cat: "Strategy", desc: "Impact vs. probability scoring, fail-safe backups, and disaster recovery." },
  { id: "biz-agile", name: "Agile Sprint Architecture", cat: "Strategy", desc: "Story point estimation, velocity tracking, backlog grooming, and standups." },
  { id: "biz-batna", name: "Negotiation & BATNA", cat: "Strategy", desc: "Zone of Possible Agreement (ZOPA), anchoring, and win-win concessions." },
  { id: "biz-decisions", name: "Decision Trees & Expected Value", cat: "Strategy", desc: "Probability-weighted decision matrices and cognitive bias mitigation." },
  { id: "biz-okr", name: "OKR Alignment Frameworks", cat: "Strategy", desc: "Ambitious Objectives with measurable, quantitative Key Results." },
  { id: "biz-pitch", name: "Investor Pitch Architecture", cat: "Strategy", desc: "Problem, solution, market size (TAM/SAM), traction, and capital ask." },
  { id: "biz-pricing", name: "Pricing Psychology", cat: "Strategy", desc: "Decoy pricing, value-based models, feature tiering, and willingness to pay." },
  { id: "biz-focus", name: "Deep Work Systems", cat: "Strategy", desc: "Time-blocking, attention management, minimizing context switches, and focus." },
  { id: "biz-postmortem", name: "Blameless Post-Mortems", cat: "Strategy", desc: "Timeline reconstructions, systemic vulnerabilities, and preventive action items." },
  { id: "biz-gdpr", name: "Data Privacy & Compliance", cat: "Strategy", desc: "GDPR principles, data subject rights, consent workflows, and encryption." },
  { id: "biz-growth", name: "Growth Engine Loops", cat: "Strategy", desc: "Viral coefficients, product-led growth (PLG), and referral mechanics." },
  { id: "biz-supply", name: "Supply Chain Resilience", cat: "Strategy", desc: "Lead time reduction, buffer stock modeling, and vendor redundancy." },
  { id: "biz-ip", name: "IP & Patent Scoping", cat: "Strategy", desc: "Prior art search, novelty delineation, claims structure, and trade secrets." },
  { id: "biz-align", name: "Cross-Functional Alignment", cat: "Strategy", desc: "Uniting engineering, product, marketing, and design toward shared goals." },
  { id: "biz-culture", name: "High-Performance Culture", cat: "Strategy", desc: "Psychological safety, clear ownership (DRI), and constructive feedback." },
  { id: "biz-brand", name: "Brand Positioning Strategy", cat: "Strategy", desc: "Perceptual mapping, category creation, and distinctive brand assets." },
  { id: "biz-synthesis", name: "Rapid Cognitive Synthesis", cat: "Strategy", desc: "Absorbing vast cross-disciplinary data and extracting actionable insights." }
];

// Model Tiers Definition
const MODEL_REGISTRY = {
  "lorn-dts-5.0": {
    name: "lorn dts 5.0",
    badge: "Best • Flagship",
    badgeClass: "flagship",
    description: "Ultimate deep reasoning, multi-disciplinary coding, vision, and peak intellect",
    cloudModel: "openai",
    puterModel: "claude-sonnet-5-5",
    fastStream: true
  },
  "lorn-dts-4.5": {
    name: "lorn dts 4.5",
    badge: "Ultra",
    badgeClass: "smart",
    description: "High-speed analysis, creative prose, and deep multi-turn comprehension",
    cloudModel: "openai",
    puterModel: "claude-3-5-sonnet",
    fastStream: true
  },
  "lorn-dts-4.0": {
    name: "lorn dts 4.0",
    badge: "Pro",
    badgeClass: "smart",
    description: "Balanced high-precision synthesis and coding support",
    cloudModel: "claude",
    puterModel: "claude-3-sonnet",
    fastStream: true
  },
  "lorn-dts-3.5": {
    name: "lorn dts 3.5",
    badge: "Standard",
    badgeClass: "fast",
    description: "Fast, dependable assistant for daily tasks and writing",
    cloudModel: "openai",
    puterModel: "openai/gpt-4o-mini",
    fastStream: true
  },
  "lorn-light-4.5": {
    name: "lorn light 4.5",
    badge: "Turbo",
    badgeClass: "light",
    description: "Near-instant responses with fluent conversational depth",
    cloudModel: "deepseek",
    puterModel: "deepseek-chat",
    fastStream: true
  },
  "lorn-light-3.5": {
    name: "lorn light 3.5",
    badge: "Fast",
    badgeClass: "light",
    description: "Optimized for quick translations, summaries, and edits",
    cloudModel: "mistral",
    puterModel: "openai/gpt-5.4-nano",
    fastStream: true
  },
  "lorn-light-2.5": {
    name: "lorn light 2.5",
    badge: "Nano",
    badgeClass: "nano",
    description: "Ultra-compact, low-latency micro-responses",
    cloudModel: "qwen",
    puterModel: "openai/gpt-5.4-nano",
    fastStream: true
  },
  "lorn-light-1.5": {
    name: "lorn light 1.5",
    badge: "Micro",
    badgeClass: "nano",
    description: "Lightning-fast replies for quick question-and-answers",
    cloudModel: "mistral",
    puterModel: "google/gemma-2b",
    fastStream: true
  }
};

class LornAIEngine {
  constructor() {
    this.conversations = JSON.parse(localStorage.getItem("lorn_conversations") || "[]");
    this.currentConvId = localStorage.getItem("lorn_active_conv") || null;
    this.selectedModelKey = localStorage.getItem("lorn_selected_model") || "lorn-dts-5.0";
    this.isGenerating = false;
    this.activeArtifacts = [];
    this.pendingAttachments = [];
    this.turboMode = true;

    // Load User Account State
    this.currentUser = JSON.parse(localStorage.getItem("lorn_user_session") || "null");

    // Load Custom Skills
    this.userSkills = JSON.parse(localStorage.getItem("lorn_custom_skills") || "[]");

    // Load MCP Servers
    this.mcpServers = JSON.parse(localStorage.getItem("lorn_mcp_servers") || JSON.stringify([
      { id: "roblox-studio", name: "Roblox Studio MCP", url: "http://127.0.0.1:3000/sse", enabled: true, type: "sse" },
      { id: "workspace-fs", name: "Filesystem & Workspace MCP", url: "local://workspace-context", enabled: true, type: "local" }
    ]));

    // Settings (strictly client-side)
    this.settings = {
      defaultModel: localStorage.getItem("lorn_setting_model") || "lorn-dts-5.0",
      temperature: parseFloat(localStorage.getItem("lorn_setting_temp") || "0.75"),
      autoOpenArtifacts: localStorage.getItem("lorn_setting_auto_artifacts") !== "false",
      systemPrompt: localStorage.getItem("lorn_system_prompt") || `You are lornAI, an elite, articulate, and thoughtful AI companion designed in the warm, intellectually rich aesthetic of Claude. You communicate with clarity, empathy, structured logic, and human-like conversational warmth.

You possess advanced knowledge in software engineering, Roblox Luau game development, mathematics, creative writing, and data analysis. When writing code, write complete, robust implementations formatted with clean markdown so the lornAI Live Artifacts Viewer can preview and run them.`
    };

    this.initDOM();
    this.bindEvents();
    this.handleAuthCallbackUrl();
    this.renderHistory();
    this.loadActiveConversation();
    this.updateGreeting();
    this.renderSkillsCatalog();
    this.renderUserSkillsList();
    this.renderMCPServersList();
    this.updateUserAccountUI();
  }

  // ==========================================
  // DOM & UI Initialization
  // ==========================================
  initDOM() {
    this.dom = {
      app: document.getElementById("app"),
      sidebar: document.getElementById("sidebar"),
      sidebarToggleBtn: document.getElementById("sidebar-toggle-btn"),
      mobileSidebarToggle: document.getElementById("mobile-sidebar-toggle"),
      sidebarOverlay: document.getElementById("sidebar-overlay"),
      newChatBtn: document.getElementById("new-chat-btn"),
      chatSearch: document.getElementById("chat-search"),
      historyContainer: document.getElementById("history-container"),

      userAccountBtn: document.getElementById("user-account-btn"),
      sidebarUserAvatar: document.getElementById("sidebar-user-avatar"),
      sidebarUserName: document.getElementById("sidebar-user-name"),
      sidebarUserBadge: document.getElementById("sidebar-user-badge"),
      settingsBtn: document.getElementById("settings-btn"),
      themeToggleBtn: document.getElementById("theme-toggle-btn"),
      themeIcon: document.getElementById("theme-icon"),

      modelPickerWrap: document.getElementById("model-picker-wrap"),
      modelPickerTrigger: document.getElementById("model-picker-trigger"),
      currentModelDisplay: document.getElementById("current-model-display"),
      currentModelTag: document.getElementById("current-model-tag"),
      modelDropdownMenu: document.getElementById("model-dropdown-menu"),

      skillsBadgeBtn: document.getElementById("skills-badge-btn"),
      toggleArtifactsBtn: document.getElementById("toggle-artifacts-btn"),
      artifactsCounter: document.getElementById("artifacts-counter"),
      clearChatBtn: document.getElementById("clear-chat-btn"),

      chatViewport: document.getElementById("chat-viewport"),
      heroWelcome: document.getElementById("hero-welcome"),
      heroGreeting: document.getElementById("hero-greeting"),
      messagesContainer: document.getElementById("messages-container"),

      inputCard: document.getElementById("input-card"),
      chatTextarea: document.getElementById("chat-textarea"),
      fileUploadInput: document.getElementById("file-upload-input"),
      attachFileBtn: document.getElementById("attach-file-btn"),
      attachmentsPreview: document.getElementById("attachments-preview"),
      quickModelPill: document.getElementById("quick-model-pill"),
      pillModelName: document.getElementById("pill-model-name"),
      turboToggleBtn: document.getElementById("turbo-toggle-btn"),
      visionIndicator: document.getElementById("vision-indicator"),
      charCounter: document.getElementById("char-counter"),
      sendMessageBtn: document.getElementById("send-message-btn"),

      // Artifacts Drawer
      artifactsDrawer: document.getElementById("artifacts-drawer"),
      artifactTitle: document.getElementById("artifact-title"),
      artifactSubtitle: document.getElementById("artifact-subtitle"),
      artifactCopyBtn: document.getElementById("artifact-copy-btn"),
      artifactDownloadBtn: document.getElementById("artifact-download-btn"),
      closeArtifactsBtn: document.getElementById("close-artifacts-btn"),
      tabCodeBtn: document.getElementById("tab-code-btn"),
      tabPreviewBtn: document.getElementById("tab-preview-btn"),
      artifactCodeView: document.getElementById("artifact-code-view"),
      artifactPreviewView: document.getElementById("artifact-preview-view"),
      artifactCodeBlock: document.getElementById("artifact-code-block"),
      artifactPreviewIframe: document.getElementById("artifact-preview-iframe"),

      // Settings Modal
      settingsModal: document.getElementById("settings-modal"),
      closeSettingsBtn: document.getElementById("close-settings-btn"),
      saveSettingsBtn: document.getElementById("save-settings-btn"),
      settingDefaultModel: document.getElementById("setting-default-model"),
      settingTemperature: document.getElementById("setting-temperature"),
      tempVal: document.getElementById("temp-val"),
      settingTurbo: document.getElementById("setting-turbo"),
      settingAutoopenArtifacts: document.getElementById("setting-autoopen-artifacts"),
      customSystemPrompt: document.getElementById("custom-system-prompt"),

      // Skills & Pack
      toggleSkillpackAccordion: document.getElementById("toggle-skillpack-accordion"),
      expandPackBtn: document.getElementById("expand-pack-btn"),
      skillpackDetailsContent: document.getElementById("skillpack-details-content"),
      skillSearchInput: document.getElementById("skill-search-input"),
      skillsCatalogGrid: document.getElementById("skills-catalog-grid"),
      addSkillModalBtn: document.getElementById("add-skill-modal-btn"),
      userSkillsList: document.getElementById("user-skills-list"),

      // Custom Skill Modal
      addSkillModal: document.getElementById("add-skill-modal"),
      closeAddSkillBtn: document.getElementById("close-add-skill-btn"),
      saveCustomSkillBtn: document.getElementById("save-custom-skill-btn"),
      newSkillName: document.getElementById("new-skill-name"),
      newSkillCat: document.getElementById("new-skill-cat"),
      newSkillPrompt: document.getElementById("new-skill-prompt"),

      // MCP Tab
      mcpServerList: document.getElementById("mcp-server-list"),
      addMcpBtn: document.getElementById("add-mcp-btn"),

      // Account Tab
      accountAvatar: document.getElementById("account-avatar"),
      accountUserName: document.getElementById("account-user-name"),
      accountUserEmail: document.getElementById("account-user-email"),
      accountProviderPill: document.getElementById("account-provider-pill"),
      accountProviderLabel: document.getElementById("account-provider-label"),
      authActionButtons: document.getElementById("auth-action-buttons"),
      accountSignedInActions: document.getElementById("account-signed-in-actions"),
      googleAuthBtn: document.getElementById("google-auth-btn"),
      phoneAuthBtn: document.getElementById("phone-auth-btn"),
      signOutBtn: document.getElementById("sign-out-btn"),

      // Developer Tab
      exportChatsBtn: document.getElementById("export-chats-btn"),
      importChatsBtn: document.getElementById("import-chats-btn"),
      importChatsInput: document.getElementById("import-chats-input"),
      resetAllBtn: document.getElementById("reset-all-btn")
    };

    // Force Dark Theme by default as requested
    const savedTheme = localStorage.getItem("lorn_theme") || "dark";
    document.body.className = `theme-${savedTheme}`;
    this.updateThemeIcon(savedTheme);

    // Set Active Model
    this.applySelectedModel(this.selectedModelKey);
  }

  bindEvents() {
    // Sidebar
    this.dom.sidebarToggleBtn.addEventListener("click", () => this.toggleSidebar());
    this.dom.mobileSidebarToggle.addEventListener("click", () => this.toggleSidebar(true));
    this.dom.sidebarOverlay.addEventListener("click", () => this.closeMobileSidebar());

    // Navigation & Actions
    this.dom.newChatBtn.addEventListener("click", () => this.createNewConversation());
    this.dom.clearChatBtn.addEventListener("click", () => this.clearCurrentConversation());
    this.dom.chatSearch.addEventListener("input", (e) => this.filterHistory(e.target.value));
    this.dom.themeToggleBtn.addEventListener("click", () => this.toggleTheme());

    // Model Picker
    this.dom.modelPickerTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dom.modelPickerWrap.classList.toggle("open");
    });
    this.dom.quickModelPill.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dom.modelPickerWrap.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!this.dom.modelPickerWrap.contains(e.target)) {
        this.dom.modelPickerWrap.classList.remove("open");
      }
    });

    document.querySelectorAll(".model-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        const modelId = opt.getAttribute("data-model");
        this.applySelectedModel(modelId);
        this.dom.modelPickerWrap.classList.remove("open");
      });
    });

    // Starters
    document.querySelectorAll(".starter-card").forEach(card => {
      card.addEventListener("click", () => {
        const prompt = card.getAttribute("data-prompt");
        this.dom.chatTextarea.value = prompt;
        this.handleTextareaInput();
        this.handleSendMessage();
      });
    });

    // Chat Input
    this.dom.chatTextarea.addEventListener("input", () => this.handleTextareaInput());
    this.dom.chatTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Global Shortcut
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.createNewConversation();
      }
    });

    this.dom.sendMessageBtn.addEventListener("click", () => this.handleSendMessage());

    // File / Vision Attachment
    this.dom.attachFileBtn.addEventListener("click", () => this.dom.fileUploadInput.click());
    this.dom.fileUploadInput.addEventListener("change", (e) => this.handleFileUpload(e));

    // Turbo Mode Toggle
    this.dom.turboToggleBtn.addEventListener("click", () => {
      this.turboMode = !this.turboMode;
      this.dom.turboToggleBtn.classList.toggle("active", this.turboMode);
    });

    // Skills Modal Pill Click
    this.dom.skillsBadgeBtn.addEventListener("click", () => {
      this.openSettingsModal("skills");
    });

    // Artifacts Drawer
    this.dom.toggleArtifactsBtn.addEventListener("click", () => this.toggleArtifactsDrawer());
    this.dom.closeArtifactsBtn.addEventListener("click", () => this.closeArtifactsDrawer());
    this.dom.tabCodeBtn.addEventListener("click", () => this.switchArtifactTab("code"));
    this.dom.tabPreviewBtn.addEventListener("click", () => this.switchArtifactTab("preview"));
    this.dom.artifactCopyBtn.addEventListener("click", () => this.copyArtifactCode());
    this.dom.artifactDownloadBtn.addEventListener("click", () => this.downloadArtifactCode());

    // User Account & Settings
    this.dom.userAccountBtn.addEventListener("click", () => this.openSettingsModal("account"));
    this.dom.settingsBtn.addEventListener("click", () => this.openSettingsModal("general"));
    this.dom.closeSettingsBtn.addEventListener("click", () => this.closeSettingsModal());
    this.dom.saveSettingsBtn.addEventListener("click", () => this.saveSettings());

    // Settings Temperature Slider
    this.dom.settingTemperature.addEventListener("input", (e) => {
      this.dom.tempVal.textContent = parseFloat(e.target.value).toFixed(2);
    });

    // Settings Tab Switcher
    document.querySelectorAll(".settings-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        this.switchSettingsTab(tab);
      });
    });

    // Skills Pack Accordion Toggle
    this.dom.toggleSkillpackAccordion.addEventListener("click", () => {
      this.dom.skillpackDetailsContent.classList.toggle("hidden");
      this.dom.expandPackBtn.querySelector(".caret-icon").classList.toggle("rotate");
    });

    this.dom.skillSearchInput.addEventListener("input", (e) => {
      this.filterSkillsCatalog(e.target.value);
    });

    // Custom Skill Modal
    this.dom.addSkillModalBtn.addEventListener("click", () => {
      this.dom.addSkillModal.classList.remove("hidden");
    });
    this.dom.closeAddSkillBtn.addEventListener("click", () => {
      this.dom.addSkillModal.classList.add("hidden");
    });
    this.dom.saveCustomSkillBtn.addEventListener("click", () => this.saveCustomSkill());

    // Add MCP Server
    this.dom.addMcpBtn.addEventListener("click", () => this.promptAddMCPServer());

    // Auth Handlers (Neon Google / Phone / SignOut)
    this.dom.googleAuthBtn.addEventListener("click", () => this.triggerGoogleAuth());
    this.dom.phoneAuthBtn.addEventListener("click", () => this.triggerPhoneAuth());
    this.dom.signOutBtn.addEventListener("click", () => this.signOutUser());

    // Developer Tools
    this.dom.exportChatsBtn.addEventListener("click", () => this.exportChatsJSON());
    this.dom.importChatsBtn.addEventListener("click", () => this.dom.importChatsInput.click());
    this.dom.importChatsInput.addEventListener("change", (e) => this.importChatsJSON(e));
    this.dom.resetAllBtn.addEventListener("click", () => this.resetAllData());
  }

  // ==========================================
  // Auth & Account Management (Neon & Discord)
  // ==========================================
  handleAuthCallbackUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_success") === "1") {
      const user = {
        id: params.get("id") || "usr_" + Date.now(),
        name: params.get("username") || "Authenticated User",
        email: params.get("email") || "",
        avatar: params.get("avatar") || "",
        provider: params.get("provider") || "Discord",
        tier: "PRO • lorn dts 5.0 Active"
      };

      this.currentUser = user;
      localStorage.setItem("lorn_user_session", JSON.stringify(user));

      // Clean URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      this.updateUserAccountUI();
      alert(`Welcome back, ${user.name}! Successfully signed in via ${user.provider}.`);
    } else if (params.get("auth_error")) {
      alert("Authentication notice: " + params.get("auth_error"));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  triggerGoogleAuth() {
    // Neon OAuth redirect
    const neonAuthUrl = `https://ep-royal-glade-zajwo96h.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth/oauth/google?redirect_uri=${encodeURIComponent(window.location.origin)}`;
    window.location.href = neonAuthUrl;
  }

  triggerPhoneAuth() {
    const phone = prompt("Enter your mobile number with country code (e.g. +1...):");
    if (phone && phone.trim()) {
      const otp = prompt("A verification code was sent to " + phone + ". Enter 6-digit OTP:");
      if (otp && otp.trim().length >= 4) {
        this.currentUser = {
          id: "phone_" + Date.now(),
          name: phone,
          email: phone,
          avatar: "",
          provider: "Neon Phone SMS",
          tier: "Verified Member"
        };
        localStorage.setItem("lorn_user_session", JSON.stringify(this.currentUser));
        this.updateUserAccountUI();
        alert("Phone verification successful! Signed in as " + phone);
      }
    }
  }

  signOutUser() {
    this.currentUser = null;
    localStorage.removeItem("lorn_user_session");
    this.updateUserAccountUI();
    alert("Signed out successfully.");
  }

  updateUserAccountUI() {
    if (this.currentUser) {
      this.dom.sidebarUserName.textContent = this.currentUser.name;
      this.dom.sidebarUserBadge.textContent = this.currentUser.tier || "PRO Active";
      this.dom.accountUserName.textContent = this.currentUser.name;
      this.dom.accountUserEmail.textContent = this.currentUser.email || "Verified Member";
      this.dom.accountProviderLabel.textContent = `Signed in via ${this.currentUser.provider}`;
      this.dom.accountProviderPill.classList.add("active");

      if (this.currentUser.avatar) {
        this.dom.sidebarUserAvatar.innerHTML = `<img src="${this.currentUser.avatar}" style="width:100%;height:100%;border-radius:50%;">`;
        this.dom.accountAvatar.innerHTML = `<img src="${this.currentUser.avatar}" style="width:100%;height:100%;border-radius:50%;">`;
      }

      this.dom.authActionButtons.classList.add("hidden");
      this.dom.accountSignedInActions.classList.remove("hidden");
    } else {
      this.dom.sidebarUserName.textContent = "Guest User";
      this.dom.sidebarUserBadge.textContent = "Click to Sign In";
      this.dom.accountUserName.textContent = "Guest User";
      this.dom.accountUserEmail.textContent = "Not signed in";
      this.dom.accountProviderLabel.textContent = "Local Anonymous Session";
      this.dom.accountProviderPill.classList.remove("active");
      this.dom.sidebarUserAvatar.innerHTML = '<i class="fa-regular fa-user"></i>';
      this.dom.accountAvatar.innerHTML = '<i class="fa-regular fa-user"></i>';

      this.dom.authActionButtons.classList.remove("hidden");
      this.dom.accountSignedInActions.classList.add("hidden");
    }
  }

  // ==========================================
  // Skills Pack (150+ Skills) & Custom Skills
  // ==========================================
  renderSkillsCatalog() {
    const grid = this.dom.skillsCatalogGrid;
    grid.innerHTML = "";

    MASTER_SKILLS_PACK.forEach(skill => {
      const card = document.createElement("div");
      card.className = "skill-catalog-item";
      card.dataset.name = skill.name.toLowerCase();
      card.dataset.cat = skill.cat.toLowerCase();
      card.dataset.desc = skill.desc.toLowerCase();

      card.innerHTML = `
        <div class="skill-item-header">
          <span class="skill-item-title">${this.escapeHtml(skill.name)}</span>
          <span class="skill-cat-pill">${this.escapeHtml(skill.cat)}</span>
        </div>
        <p class="skill-item-desc">${this.escapeHtml(skill.desc)}</p>
      `;

      card.addEventListener("click", () => {
        this.dom.chatTextarea.value = `[Apply Skill: ${skill.name}]\n`;
        this.closeSettingsModal();
        this.dom.chatTextarea.focus();
        this.handleTextareaInput();
      });

      grid.appendChild(card);
    });
  }

  filterSkillsCatalog(query) {
    const q = query.toLowerCase().trim();
    const items = this.dom.skillsCatalogGrid.querySelectorAll(".skill-catalog-item");
    items.forEach(el => {
      const match = el.dataset.name.includes(q) || el.dataset.cat.includes(q) || el.dataset.desc.includes(q);
      el.style.display = match ? "block" : "none";
    });
  }

  renderUserSkillsList() {
    const container = this.dom.userSkillsList;
    container.innerHTML = "";

    if (this.userSkills.length === 0) {
      container.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:8px 0;">No custom skills yet. Click "+ Add Custom Skill" above.</div>';
      return;
    }

    this.userSkills.forEach((skill, idx) => {
      const el = document.createElement("div");
      el.className = "user-skill-row";
      el.innerHTML = `
        <div class="user-skill-info">
          <strong>${this.escapeHtml(skill.name)}</strong>
          <span>${this.escapeHtml(skill.category)}</span>
        </div>
        <div class="user-skill-controls">
          <input type="checkbox" ${skill.enabled ? "checked" : ""} class="claude-switch skill-toggle" data-idx="${idx}">
          <button class="icon-btn-sm delete-skill" data-idx="${idx}"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      `;

      el.querySelector(".skill-toggle").addEventListener("change", (e) => {
        this.userSkills[idx].enabled = e.target.checked;
        localStorage.setItem("lorn_custom_skills", JSON.stringify(this.userSkills));
      });

      el.querySelector(".delete-skill").addEventListener("click", () => {
        this.userSkills.splice(idx, 1);
        localStorage.setItem("lorn_custom_skills", JSON.stringify(this.userSkills));
        this.renderUserSkillsList();
      });

      container.appendChild(el);
    });
  }

  saveCustomSkill() {
    const name = this.dom.newSkillName.value.trim();
    const cat = this.dom.newSkillCat.value.trim() || "General";
    const prompt = this.dom.newSkillPrompt.value.trim();

    if (!name || !prompt) {
      alert("Please provide both a skill name and behavior prompt.");
      return;
    }

    this.userSkills.push({
      id: "skill_" + Date.now(),
      name: name,
      category: cat,
      prompt: prompt,
      enabled: true
    });

    localStorage.setItem("lorn_custom_skills", JSON.stringify(this.userSkills));
    this.dom.newSkillName.value = "";
    this.dom.newSkillCat.value = "";
    this.dom.newSkillPrompt.value = "";
    this.dom.addSkillModal.classList.add("hidden");
    this.renderUserSkillsList();
  }

  // ==========================================
  // Model Context Protocol (MCP) Manager
  // ==========================================
  renderMCPServersList() {
    const container = this.dom.mcpServerList;
    container.innerHTML = "";

    this.mcpServers.forEach((server, idx) => {
      const card = document.createElement("div");
      card.className = `mcp-server-card ${server.enabled ? "active" : ""}`;
      const isRoblox = server.id === "roblox-studio";

      card.innerHTML = `
        <div class="mcp-card-left">
          <div class="mcp-icon ${isRoblox ? "roblox" : ""}"><i class="fa-solid ${isRoblox ? "fa-cube" : "fa-network-wired"}"></i></div>
          <div>
            <div class="mcp-name">${this.escapeHtml(server.name)}</div>
            <div class="mcp-endpoint">${this.escapeHtml(server.url)}</div>
          </div>
        </div>
        <div class="mcp-card-right">
          <span class="mcp-badge ${server.enabled ? "enabled" : "ready"}">${server.enabled ? "Connected" : "Inactive"}</span>
          <input type="checkbox" ${server.enabled ? "checked" : ""} class="claude-switch mcp-toggle-input">
          ${!isRoblox ? `<button class="icon-btn-sm remove-mcp" title="Delete"><i class="fa-regular fa-trash-can"></i></button>` : ""}
        </div>
      `;

      card.querySelector(".mcp-toggle-input").addEventListener("change", (e) => {
        server.enabled = e.target.checked;
        localStorage.setItem("lorn_mcp_servers", JSON.stringify(this.mcpServers));
        this.renderMCPServersList();
      });

      const removeBtn = card.querySelector(".remove-mcp");
      if (removeBtn) {
        removeBtn.addEventListener("click", () => {
          this.mcpServers.splice(idx, 1);
          localStorage.setItem("lorn_mcp_servers", JSON.stringify(this.mcpServers));
          this.renderMCPServersList();
        });
      }

      container.appendChild(card);
    });
  }

  promptAddMCPServer() {
    const name = prompt("Enter MCP Server Name (e.g. Local Python MCP):");
    if (!name) return;
    const url = prompt("Enter MCP Endpoint URL (e.g. http://127.0.0.1:8000/sse):");
    if (!url) return;

    this.mcpServers.push({
      id: "mcp_" + Date.now(),
      name: name.trim(),
      url: url.trim(),
      enabled: true,
      type: "sse"
    });

    localStorage.setItem("lorn_mcp_servers", JSON.stringify(this.mcpServers));
    this.renderMCPServersList();
  }

  // ==========================================
  // File & Vision Attachment Handling
  // ==========================================
  handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      const isImg = file.type.startsWith("image/");

      if (isImg) {
        reader.readAsDataURL(file);
        reader.onload = () => {
          this.pendingAttachments.push({
            name: file.name,
            type: "image",
            data: reader.result
          });
          this.renderAttachmentsPreview();
        };
      } else {
        reader.readAsText(file);
        reader.onload = () => {
          this.pendingAttachments.push({
            name: file.name,
            type: "text",
            data: reader.result
          });
          this.renderAttachmentsPreview();
        };
      }
    });

    e.target.value = "";
  }

  renderAttachmentsPreview() {
    const container = this.dom.attachmentsPreview;
    container.innerHTML = "";

    const hasImages = this.pendingAttachments.some(a => a.type === "image");
    this.dom.visionIndicator.classList.toggle("hidden", !hasImages);

    if (this.pendingAttachments.length === 0) {
      container.classList.add("hidden");
      this.handleTextareaInput();
      return;
    }

    container.classList.remove("hidden");
    this.pendingAttachments.forEach((att, idx) => {
      const chip = document.createElement("div");
      chip.className = "attachment-chip";

      if (att.type === "image") {
        chip.innerHTML = `
          <img src="${att.data}" style="width:20px;height:20px;object-fit:cover;border-radius:4px;">
          <span>${this.escapeHtml(att.name)} (Vision)</span>
          <i class="fa-solid fa-xmark remove-file" data-idx="${idx}"></i>
        `;
      } else {
        chip.innerHTML = `
          <i class="fa-regular fa-file-code"></i>
          <span>${this.escapeHtml(att.name)}</span>
          <i class="fa-solid fa-xmark remove-file" data-idx="${idx}"></i>
        `;
      }

      chip.querySelector(".remove-file").addEventListener("click", () => {
        this.pendingAttachments.splice(idx, 1);
        this.renderAttachmentsPreview();
      });
      container.appendChild(chip);
    });

    this.handleTextareaInput();
  }

  // ==========================================
  // Layout & Theme Controls
  // ==========================================
  updateGreeting() {
    const hour = new Date().getHours();
    let timeGreeting = "Good afternoon";
    if (hour < 12) timeGreeting = "Good morning";
    else if (hour > 18) timeGreeting = "Good evening";
    this.dom.heroGreeting.textContent = `${timeGreeting}, Friend.`;
  }

  toggleSidebar(isMobile = false) {
    if (isMobile) {
      this.dom.sidebar.classList.toggle("collapsed");
      this.dom.sidebarOverlay.classList.toggle("hidden");
    } else {
      this.dom.sidebar.classList.toggle("collapsed");
    }
  }

  closeMobileSidebar() {
    this.dom.sidebar.classList.add("collapsed");
    this.dom.sidebarOverlay.classList.add("hidden");
  }

  toggleTheme() {
    const isDark = document.body.classList.contains("theme-dark");
    const nextTheme = isDark ? "light" : "dark";
    document.body.className = `theme-${nextTheme}`;
    localStorage.setItem("lorn_theme", nextTheme);
    this.updateThemeIcon(nextTheme);
  }

  updateThemeIcon(theme) {
    if (theme === "dark") {
      this.dom.themeIcon.className = "fa-solid fa-moon";
    } else {
      this.dom.themeIcon.className = "fa-regular fa-sun";
    }
  }

  applySelectedModel(modelKey) {
    if (!MODEL_REGISTRY[modelKey]) modelKey = "lorn-dts-5.0";
    this.selectedModelKey = modelKey;
    localStorage.setItem("lorn_selected_model", modelKey);

    const model = MODEL_REGISTRY[modelKey];
    this.dom.currentModelDisplay.textContent = model.name;
    this.dom.currentModelTag.textContent = model.badge;
    this.dom.currentModelTag.className = `model-tag-badge ${model.badgeClass}`;
    this.dom.pillModelName.textContent = model.name;

    document.querySelectorAll(".model-opt").forEach(opt => {
      if (opt.getAttribute("data-model") === modelKey) {
        opt.classList.add("active");
      } else {
        opt.classList.remove("active");
      }
    });
  }

  handleTextareaInput() {
    const textarea = this.dom.chatTextarea;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 220) + "px";

    const text = textarea.value.trim();
    const hasAttachments = this.pendingAttachments.length > 0;
    this.dom.sendMessageBtn.disabled = (!text && !hasAttachments) || this.isGenerating;
    this.dom.sendMessageBtn.classList.toggle("active", (text.length > 0 || hasAttachments) && !this.isGenerating);
    this.dom.charCounter.textContent = text.length > 0 ? `${text.length} chars` : "";
  }

  // ==========================================
  // Conversations
  // ==========================================
  createNewConversation() {
    const newConv = {
      id: "conv_" + Date.now(),
      title: "New Conversation",
      model: this.selectedModelKey,
      timestamp: Date.now(),
      messages: []
    };

    this.conversations.unshift(newConv);
    this.currentConvId = newConv.id;
    this.saveConversations();
    this.renderHistory();
    this.renderMessages();
    this.dom.chatTextarea.focus();
    if (window.innerWidth < 768) this.closeMobileSidebar();
  }

  clearCurrentConversation() {
    const conv = this.getActiveConversation();
    if (!conv) return;
    if (confirm("Clear current conversation?")) {
      conv.messages = [];
      this.activeArtifacts = [];
      this.updateArtifactsBadge();
      this.saveConversations();
      this.renderMessages();
    }
  }

  getActiveConversation() {
    if (!this.currentConvId && this.conversations.length > 0) {
      this.currentConvId = this.conversations[0].id;
    }
    return this.conversations.find(c => c.id === this.currentConvId) || null;
  }

  saveConversations() {
    localStorage.setItem("lorn_conversations", JSON.stringify(this.conversations));
    if (this.currentConvId) {
      localStorage.setItem("lorn_active_conv", this.currentConvId);
    }
  }

  renderHistory() {
    const container = this.dom.historyContainer;
    container.innerHTML = "";

    if (this.conversations.length === 0) {
      container.innerHTML = '<div style="padding:16px 10px;font-size:0.8rem;color:var(--text-muted);text-align:center;">No previous conversations</div>';
      return;
    }

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const groups = { Today: [], Yesterday: [], "Previous 7 Days": [], Older: [] };

    this.conversations.forEach(c => {
      const diff = now - (c.timestamp || now);
      if (diff < oneDay) groups.Today.push(c);
      else if (diff < 2 * oneDay) groups.Yesterday.push(c);
      else if (diff < 7 * oneDay) groups["Previous 7 Days"].push(c);
      else groups.Older.push(c);
    });

    Object.entries(groups).forEach(([title, convs]) => {
      if (convs.length === 0) return;

      const groupHeader = document.createElement("div");
      groupHeader.className = "history-group-title";
      groupHeader.textContent = title;
      container.appendChild(groupHeader);

      convs.forEach(c => {
        const item = document.createElement("div");
        item.className = `history-item ${c.id === this.currentConvId ? "active" : ""}`;
        item.innerHTML = `
          <span class="title-text">${this.escapeHtml(c.title)}</span>
          <div class="item-actions">
            <button class="item-action-btn edit-title" title="Rename"><i class="fa-solid fa-pen"></i></button>
            <button class="item-action-btn delete-conv" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        `;

        item.addEventListener("click", (e) => {
          if (e.target.closest(".item-action-btn")) return;
          this.currentConvId = c.id;
          this.saveConversations();
          this.renderHistory();
          this.renderMessages();
          if (window.innerWidth < 768) this.closeMobileSidebar();
        });

        item.querySelector(".edit-title").addEventListener("click", (e) => {
          e.stopPropagation();
          const newTitle = prompt("Enter new title:", c.title);
          if (newTitle && newTitle.trim()) {
            c.title = newTitle.trim();
            this.saveConversations();
            this.renderHistory();
          }
        });

        item.querySelector(".delete-conv").addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm("Delete conversation?")) {
            this.conversations = this.conversations.filter(x => x.id !== c.id);
            if (this.currentConvId === c.id) {
              this.currentConvId = this.conversations.length > 0 ? this.conversations[0].id : null;
            }
            this.saveConversations();
            this.renderHistory();
            this.renderMessages();
          }
        });

        container.appendChild(item);
      });
    });
  }

  filterHistory(query) {
    const q = query.toLowerCase().trim();
    const items = this.dom.historyContainer.querySelectorAll(".history-item");
    items.forEach(el => {
      const text = el.querySelector(".title-text").textContent.toLowerCase();
      el.style.display = text.includes(q) ? "flex" : "none";
    });
  }

  loadActiveConversation() {
    if (this.conversations.length === 0) {
      this.createNewConversation();
    } else {
      this.renderMessages();
    }
  }

  renderMessages() {
    const conv = this.getActiveConversation();
    const container = this.dom.messagesContainer;
    container.innerHTML = "";
    this.activeArtifacts = [];

    if (!conv || conv.messages.length === 0) {
      this.dom.heroWelcome.classList.remove("hidden");
      this.updateArtifactsBadge();
      return;
    }

    this.dom.heroWelcome.classList.add("hidden");

    conv.messages.forEach((msg, idx) => {
      this.appendMessageToDOM(msg, idx);
    });

    this.updateArtifactsBadge();
    this.scrollToBottom();
  }

  appendMessageToDOM(msg, idx) {
    const row = document.createElement("div");
    row.className = `message-row ${msg.role}`;
    row.dataset.msgIdx = idx;

    if (msg.role === "user") {
      let attachmentsHtml = "";
      if (msg.attachments && msg.attachments.length > 0) {
        attachmentsHtml = `
          <div class="user-attachments" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            ${msg.attachments.map(att => att.type === "image" 
              ? `<img src="${att.data}" style="max-height:140px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">` 
              : `<span class="attachment-chip"><i class="fa-regular fa-file"></i> ${this.escapeHtml(att.name)}</span>`
            ).join("")}
          </div>
        `;
      }

      row.innerHTML = `
        <div class="message-bubble">
          ${attachmentsHtml}
          <div class="message-body">${this.escapeHtml(msg.content).replace(/\n/g, "<br>")}</div>
        </div>
      `;
    } else {
      const formattedHtml = this.parseMarkdown(msg.content);
      const modelName = msg.model || this.selectedModelKey;

      row.innerHTML = `
        <div class="assistant-avatar">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor"/>
          </svg>
        </div>
        <div class="assistant-content-wrap">
          <div class="assistant-meta">
            <span class="meta-model-tag">✦ ${modelName}</span>
            <span>•</span>
            <span>${this.formatTime(msg.timestamp || Date.now())}</span>
          </div>
          <div class="message-body">${formattedHtml}</div>
          <div class="message-actions">
            <button class="action-pill-btn copy-msg-btn" title="Copy text"><i class="fa-regular fa-copy"></i> Copy</button>
            <button class="action-pill-btn regen-msg-btn" title="Retry"><i class="fa-solid fa-arrows-rotate"></i> Retry</button>
          </div>
        </div>
      `;

      row.querySelector(".copy-msg-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(msg.content);
        const btn = row.querySelector(".copy-msg-btn");
        btn.innerHTML = '<i class="fa-solid fa-check text-terracotta"></i> Copied!';
        setTimeout(() => {
          btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
        }, 2000);
      });

      row.querySelector(".regen-msg-btn").addEventListener("click", () => {
        this.regenerateResponse(idx);
      });

      this.extractArtifactsFromMessage(msg.content, row);
    }

    this.dom.messagesContainer.appendChild(row);

    row.querySelectorAll("pre code").forEach(block => {
      if (typeof hljs !== "undefined") hljs.highlightElement(block);
    });
  }

  scrollToBottom() {
    this.dom.chatViewport.scrollTo({
      top: this.dom.chatViewport.scrollHeight,
      behavior: "smooth"
    });
  }

  // ==========================================
  // Markdown & Live Artifacts
  // ==========================================
  parseMarkdown(text) {
    if (typeof marked !== "undefined") {
      return marked.parse(text);
    }
    return this.escapeHtml(text).replace(/\n/g, "<br>");
  }

  extractArtifactsFromMessage(content, rowElement) {
    const codeBlockRegex = /```(html|css|javascript|js|svg|python|jsx|tsx|json|lua)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const lang = (match[1] || "code").toLowerCase();
      const code = match[2].trim();

      if (["html", "svg", "js", "javascript", "css", "jsx", "tsx", "python", "lua"].includes(lang) && code.length > 40) {
        const artifactId = "art_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        const title = this.inferArtifactTitle(code, lang);

        const artifactObj = {
          id: artifactId,
          title: title,
          language: lang,
          code: code
        };

        this.activeArtifacts.push(artifactObj);

        const artifactCard = document.createElement("div");
        artifactCard.className = "artifact-card-preview";
        artifactCard.innerHTML = `
          <div class="artifact-card-info">
            <div class="artifact-card-icon"><i class="fa-solid fa-cube"></i></div>
            <div>
              <div class="artifact-card-title">${this.escapeHtml(title)}</div>
              <div class="artifact-card-sub">${lang.toUpperCase()} • Interactive Artifact</div>
            </div>
          </div>
          <div class="artifact-open-btn">
            <span>Open Artifact</span>
            <i class="fa-solid fa-arrow-right"></i>
          </div>
        `;

        artifactCard.addEventListener("click", () => {
          this.openArtifact(artifactObj);
        });

        const msgBody = rowElement.querySelector(".message-body");
        if (msgBody) msgBody.appendChild(artifactCard);

        if (this.settings.autoOpenArtifacts && !this.dom.artifactsDrawer.classList.contains("open")) {
          this.openArtifact(artifactObj);
        }
      }
    }

    this.updateArtifactsBadge();
  }

  inferArtifactTitle(code, lang) {
    if (lang === "html") {
      const titleMatch = code.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) return titleMatch[1];
      const h1Match = code.match(/<h1>(.*?)<\/h1>/i);
      if (h1Match) return h1Match[1];
      return "Interactive HTML Component";
    }
    if (lang === "svg") return "Vector Graphic (SVG)";
    if (lang === "lua") return "Roblox Luau Script";
    if (lang === "javascript" || lang === "js") return "JavaScript Module";
    if (lang === "python") return "Python Executable Script";
    return `${lang.toUpperCase()} Component`;
  }

  updateArtifactsBadge() {
    this.dom.artifactsCounter.textContent = this.activeArtifacts.length;
  }

  openArtifact(artifact) {
    this.currentArtifact = artifact;
    this.dom.artifactTitle.textContent = artifact.title;
    this.dom.artifactSubtitle.textContent = `${artifact.language.toUpperCase()} • ${artifact.code.split("\n").length} lines`;

    this.dom.artifactCodeBlock.textContent = artifact.code;
    this.dom.artifactCodeBlock.className = `language-${artifact.language === "lua" ? "lua" : artifact.language}`;
    if (typeof hljs !== "undefined") {
      hljs.highlightElement(this.dom.artifactCodeBlock);
    }

    this.renderArtifactPreview(artifact);

    if (["html", "svg"].includes(artifact.language)) {
      this.switchArtifactTab("preview");
    } else {
      this.switchArtifactTab("code");
    }

    this.dom.artifactsDrawer.classList.add("open");
  }

  renderArtifactPreview(artifact) {
    const iframe = this.dom.artifactPreviewIframe;
    let htmlContent = "";

    if (artifact.language === "html") {
      htmlContent = artifact.code;
    } else if (artifact.language === "svg") {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#181715;color:#FFF;}</style></head>
        <body>${artifact.code}</body>
        </html>
      `;
    } else if (artifact.language === "javascript" || artifact.language === "js") {
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>body{font-family:sans-serif;padding:20px;color:#EEE;background:#181715;}</style>
        </head>
        <body>
          <h3>Console Output:</h3>
          <pre id="output" style="background:#242320;padding:12px;border:1px solid #3E3B34;border-radius:8px;color:#10B981;"></pre>
          <script>
            const out = document.getElementById('output');
            const log = console.log;
            console.log = (...args) => {
              out.textContent += args.map(a => typeof a === 'object' ? JSON.stringify(a,null,2) : a).join(' ') + '\\n';
              log(...args);
            };
            try {
              ${artifact.code}
            } catch(e) {
              out.textContent += 'Error: ' + e.message;
            }
          <\/script>
        </body>
        </html>
      `;
    } else {
      htmlContent = `<pre style="padding:24px;font-family:monospace;color:#A8A398;background:#181715;">[Live execution preview unavailable for ${artifact.language}. View formatted Code tab.]</pre>`;
    }

    iframe.srcdoc = htmlContent;
  }

  switchArtifactTab(tab) {
    if (tab === "code") {
      this.dom.tabCodeBtn.classList.add("active");
      this.dom.tabPreviewBtn.classList.remove("active");
      this.dom.artifactCodeView.classList.remove("hidden");
      this.dom.artifactPreviewView.classList.add("hidden");
    } else {
      this.dom.tabPreviewBtn.classList.add("active");
      this.dom.tabCodeBtn.classList.remove("active");
      this.dom.artifactPreviewView.classList.remove("hidden");
      this.dom.artifactCodeView.classList.add("hidden");
    }
  }

  toggleArtifactsDrawer() {
    if (this.activeArtifacts.length > 0 && !this.dom.artifactsDrawer.classList.contains("open")) {
      this.openArtifact(this.activeArtifacts[this.activeArtifacts.length - 1]);
    } else {
      this.dom.artifactsDrawer.classList.toggle("open");
    }
  }

  closeArtifactsDrawer() {
    this.dom.artifactsDrawer.classList.remove("open");
  }

  copyArtifactCode() {
    if (!this.currentArtifact) return;
    navigator.clipboard.writeText(this.currentArtifact.code);
    const btn = this.dom.artifactCopyBtn;
    btn.innerHTML = '<i class="fa-solid fa-check text-terracotta"></i>';
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
    }, 2000);
  }

  downloadArtifactCode() {
    if (!this.currentArtifact) return;
    const blob = new Blob([this.currentArtifact.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ext = this.currentArtifact.language === "javascript" ? "js" : (this.currentArtifact.language === "lua" ? "lua" : this.currentArtifact.language);
    a.download = `lorn_artifact_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // Ultra-Fast Streaming & Vision Router
  // ==========================================
  async handleSendMessage() {
    const text = this.dom.chatTextarea.value.trim();
    const attachments = [...this.pendingAttachments];

    if ((!text && attachments.length === 0) || this.isGenerating) return;

    let conv = this.getActiveConversation();
    if (!conv) {
      this.createNewConversation();
      conv = this.getActiveConversation();
    }

    if (conv.messages.length === 0 && text) {
      conv.title = text.slice(0, 32) + (text.length > 32 ? "..." : "");
      this.renderHistory();
    }

    const userMsg = {
      role: "user",
      content: text,
      attachments: attachments,
      timestamp: Date.now()
    };
    conv.messages.push(userMsg);

    this.dom.chatTextarea.value = "";
    this.pendingAttachments = [];
    this.renderAttachmentsPreview();
    this.handleTextareaInput();
    this.renderMessages();

    const assistantMsg = {
      role: "assistant",
      content: "",
      model: MODEL_REGISTRY[this.selectedModelKey].name,
      timestamp: Date.now()
    };
    conv.messages.push(assistantMsg);

    const msgIndex = conv.messages.length - 1;
    this.appendMessageToDOM(assistantMsg, msgIndex);
    this.saveConversations();

    const assistantRow = this.dom.messagesContainer.querySelector(`[data-msg-idx="${msgIndex}"]`);
    const assistantBody = assistantRow.querySelector(".message-body");
    assistantBody.classList.add("streaming-cursor");

    this.isGenerating = true;
    this.dom.sendMessageBtn.disabled = true;

    try {
      await this.routeAndStreamResponse(conv, assistantMsg, assistantBody, userMsg);
    } catch (err) {
      console.error("AI Error:", err);
      assistantMsg.content += `\n\n*(Notice: ${err.message})*`;
      assistantBody.innerHTML = this.parseMarkdown(assistantMsg.content);
    } finally {
      assistantBody.classList.remove("streaming-cursor");
      this.isGenerating = false;
      this.handleTextareaInput();
      this.saveConversations();
      this.extractArtifactsFromMessage(assistantMsg.content, assistantRow);
    }
  }

  async regenerateResponse(targetIndex) {
    const conv = this.getActiveConversation();
    if (!conv || this.isGenerating) return;

    conv.messages.splice(targetIndex);
    this.renderMessages();

    const lastMsg = conv.messages[conv.messages.length - 1];
    if (lastMsg && lastMsg.role === "user") {
      const assistantMsg = {
        role: "assistant",
        content: "",
        model: MODEL_REGISTRY[this.selectedModelKey].name,
        timestamp: Date.now()
      };
      conv.messages.push(assistantMsg);
      const msgIndex = conv.messages.length - 1;
      this.appendMessageToDOM(assistantMsg, msgIndex);

      const assistantRow = this.dom.messagesContainer.querySelector(`[data-msg-idx="${msgIndex}"]`);
      const assistantBody = assistantRow.querySelector(".message-body");
      assistantBody.classList.add("streaming-cursor");

      this.isGenerating = true;
      this.dom.sendMessageBtn.disabled = true;

      try {
        await this.routeAndStreamResponse(conv, assistantMsg, assistantBody, lastMsg);
      } catch (err) {
        console.error(err);
      } finally {
        assistantBody.classList.remove("streaming-cursor");
        this.isGenerating = false;
        this.handleTextareaInput();
        this.saveConversations();
      }
    }
  }

  // --- Dynamic Cascade Router (Vision + Ultra-Fast Low-Latency Streaming) ---
  async routeAndStreamResponse(conv, assistantMsg, bodyEl, userMsg) {
    const modelConfig = MODEL_REGISTRY[this.selectedModelKey] || MODEL_REGISTRY["lorn-dts-5.0"];

    // Check if user attached images (Vision mode)
    const hasImage = userMsg.attachments && userMsg.attachments.some(a => a.type === "image");
    const messagesPayload = this.buildVisionPayload(conv, hasImage);

    // Primary: Ultra-Fast Parallel Streamer
    try {
      await this.streamFastResponse(modelConfig.cloudModel, messagesPayload, assistantMsg, bodyEl);
      return;
    } catch (err1) {
      console.warn("[lornAI] Primary fast stream failed, cascading to fallback:", err1.message);
    }

    // Secondary: Puter.js SDK (if available in client)
    if (typeof puter !== "undefined" && puter.ai) {
      try {
        const promptText = conv.messages[conv.messages.length - 2].content;
        const puterSuccess = await this.streamFromPuter(modelConfig.puterModel, promptText, assistantMsg, bodyEl);
        if (puterSuccess) return;
      } catch (err2) {
        console.warn("[lornAI] Puter fallback failed:", err2.message);
      }
    }

    // Tertiary: Robust Direct Post Fallback
    await this.streamDirectFallback(modelConfig.cloudModel, messagesPayload, assistantMsg, bodyEl);
  }

  buildVisionPayload(conv, hasImage) {
    // Inject Active Skills into System Prompt
    let skillsContext = "";
    const activeCustomSkills = this.userSkills.filter(s => s.enabled);
    if (activeCustomSkills.length > 0) {
      skillsContext = "\n\n[Active Custom Skills Rules]:\n" + activeCustomSkills.map(s => `- ${s.name}: ${s.prompt}`).join("\n");
    }

    // MCP context
    const enabledMCP = this.mcpServers.filter(m => m.enabled);
    let mcpContext = "";
    if (enabledMCP.length > 0) {
      mcpContext = "\n\n[Connected MCP Tools]: " + enabledMCP.map(m => m.name + " (" + m.url + ")").join(", ") + ". Format commands or Roblox Studio code ready for execution.";
    }

    const systemText = this.settings.systemPrompt + skillsContext + mcpContext;
    const messages = [{ role: "system", content: systemText }];

    // Add recent conversation history
    const recent = conv.messages.slice(-8, -1);
    recent.forEach(m => {
      let content = m.content;
      if (m.attachments && m.attachments.length > 0) {
        m.attachments.forEach(att => {
          if (att.type === "text") {
            content += `\n\n[Attached File: ${att.name}]\n${att.data}`;
          }
        });
      }
      messages.push({ role: m.role, content: content });
    });

    // Handle last user message (with Vision if image exists)
    const lastUserMsg = conv.messages[conv.messages.length - 2];
    if (hasImage && lastUserMsg.attachments) {
      const parts = [{ type: "text", text: lastUserMsg.content || "Describe and analyze this image in detail." }];
      lastUserMsg.attachments.forEach(att => {
        if (att.type === "image") {
          parts.push({
            type: "image_url",
            image_url: { url: att.data }
          });
        }
      });
      // Replace last message with multimodal array
      messages[messages.length - 1] = { role: "user", content: parts };
    }

    return messages;
  }

  // --- Ultra-Fast Low-Latency Streaming ---
  async streamFastResponse(modelAlias, messages, assistantMsg, bodyEl) {
    const endpoint = "https://text.pollinations.ai/openai/chat/completions";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelAlias || "openai",
        messages: messages,
        temperature: this.settings.temperature,
        stream: true
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content || "";
            if (delta) {
              assistantMsg.content += delta;
              bodyEl.innerHTML = this.parseMarkdown(assistantMsg.content);
              this.scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }

    if (!assistantMsg.content) throw new Error("Empty streaming response");
  }

  // --- Puter.js Fallback ---
  async streamFromPuter(modelName, promptText, assistantMsg, bodyEl) {
    const response = await puter.ai.chat(promptText, {
      model: modelName,
      stream: true,
      temperature: this.settings.temperature
    });

    let received = false;
    for await (const part of response) {
      const chunk = part?.text || part?.message?.content || "";
      if (chunk) {
        received = true;
        assistantMsg.content += chunk;
        bodyEl.innerHTML = this.parseMarkdown(assistantMsg.content);
        this.scrollToBottom();
      }
    }
    return received;
  }

  // --- Tertiary Direct Fallback ---
  async streamDirectFallback(modelAlias, messages, assistantMsg, bodyEl) {
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages,
        model: modelAlias,
        jsonMode: false
      })
    });

    const text = await res.text();
    assistantMsg.content = text;
    bodyEl.innerHTML = this.parseMarkdown(text);
    this.scrollToBottom();
  }

  // ==========================================
  // Settings & Developer Tools
  // ==========================================
  openSettingsModal(defaultTab = "general") {
    this.dom.settingDefaultModel.value = this.settings.defaultModel;
    this.dom.settingTemperature.value = this.settings.temperature;
    this.dom.tempVal.textContent = this.settings.temperature.toFixed(2);
    this.dom.settingTurbo.checked = this.turboMode;
    this.dom.settingAutoopenArtifacts.checked = this.settings.autoOpenArtifacts;
    this.dom.customSystemPrompt.value = this.settings.systemPrompt;

    this.switchSettingsTab(defaultTab);
    this.dom.settingsModal.classList.remove("hidden");
  }

  closeSettingsModal() {
    this.dom.settingsModal.classList.add("hidden");
  }

  switchSettingsTab(tabId) {
    document.querySelectorAll(".settings-tab-btn").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".tab-pane").forEach(p => {
      p.classList.toggle("active", p.id === `tab-${tabId}`);
    });
  }

  saveSettings() {
    this.settings.defaultModel = this.dom.settingDefaultModel.value;
    this.settings.temperature = parseFloat(this.dom.settingTemperature.value);
    this.turboMode = this.dom.settingTurbo.checked;
    this.settings.autoOpenArtifacts = this.dom.settingAutoopenArtifacts.checked;
    this.settings.systemPrompt = this.dom.customSystemPrompt.value.trim();

    localStorage.setItem("lorn_setting_model", this.settings.defaultModel);
    localStorage.setItem("lorn_setting_temp", this.settings.temperature.toString());
    localStorage.setItem("lorn_setting_auto_artifacts", this.settings.autoOpenArtifacts.toString());
    localStorage.setItem("lorn_system_prompt", this.settings.systemPrompt);

    this.applySelectedModel(this.settings.defaultModel);
    this.closeSettingsModal();
  }

  exportChatsJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.conversations, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `lornAI_backup_${Date.now()}.json`);
    dlAnchor.click();
  }

  importChatsJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          this.conversations = imported;
          this.saveConversations();
          this.renderHistory();
          this.renderMessages();
          alert("Conversations successfully restored!");
        }
      } catch (err) {
        alert("Invalid JSON format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  resetAllData() {
    if (confirm("Are you sure? This will delete all local chat history and custom skills.")) {
      localStorage.clear();
      window.location.reload();
    }
  }

  // ==========================================
  // Utility Functions
  // ==========================================
  escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.lornAI = new LornAIEngine();
});

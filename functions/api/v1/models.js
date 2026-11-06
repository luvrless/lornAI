/**
 * Cloudflare Pages Function: GET /api/v1/models
 * Returns the roster of Lorn & Fabel intelligence models (OpenAI-compatible)
 */

export async function onRequestGet() {
  const models = [
    {
      id: "lorn-5.5-sovereign",
      name: "Lorn 5.5 DTS Sovereign",
      created: 1730900000,
      owned_by: "lornAI",
      context_window: 200000,
      description: "Flagship foundation omni model with massive 200k context, supreme reasoning, and multimodal parsing."
    },
    {
      id: "fabel-4-architect",
      name: "Fabel 4.0 Architect",
      created: 1730900000,
      owned_by: "lornAI",
      context_window: 128000,
      description: "Premier coding engine for full-stack architecture, systems design, and zero-defect code synthesis."
    },
    {
      id: "fabel-quantum-reasoner",
      name: "Fabel Quantum Reasoner",
      created: 1730900000,
      owned_by: "lornAI",
      context_window: 128000,
      description: "Deep mathematical logic, formal proofs, scientific deduction, and multi-stage analysis."
    },
    {
      id: "fabel-lumina-vision",
      name: "Fabel Lumina Vision",
      created: 1730900000,
      owned_by: "lornAI",
      context_window: 128000,
      description: "Multimodal image understanding, visual analysis, and high-fidelity creative generation."
    },
    {
      id: "lorn-5.0-nexus",
      name: "Lorn 5.0 DTS Nexus",
      created: 1730900000,
      owned_by: "lornAI",
      context_window: 128000,
      description: "Nuanced synthesis, balanced daily workflow, and analytical essayist."
    },
    {
      id: "lorn-mirage-swift",
      name: "Lorn Mirage Swift",
      created: 1730900000,
      owned_by: "lornAI",
      context_window: 64000,
      description: "Sub-second latency, lightweight snappy conversations, and rapid brainstorming."
    }
  ];

  return new Response(JSON.stringify({ object: "list", data: models }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

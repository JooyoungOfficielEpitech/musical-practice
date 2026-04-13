// supabase/functions/omr-process/index.ts
// OMR (Optical Music Recognition) Edge Function
// Receives a sheet music image and returns MusicXML

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── Provider Interface ─────────────────────────────────────────────

interface OmrProvider {
  name: string;
  processImage(image: string | Uint8Array): Promise<string>; // returns MusicXML
}

// ─── Mock Provider (default, for testing) ───────────────────────────

const mockProvider: OmrProvider = {
  name: "mock",
  async processImage(_image: string | Uint8Array): Promise<string> {
    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 1500));

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>OMR Result</part-name>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction>
        <sound tempo="120"/>
      </direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
    </measure>
    <measure number="3">
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
    <measure number="4">
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;
  },
};

// ─── Halbestunde Provider (skeleton) ────────────────────────────────

function createHalbestundeProvider(): OmrProvider {
  const apiKey = Deno.env.get("OMR_API_KEY");
  if (!apiKey) throw new Error("OMR_API_KEY not set for Halbestunde provider");

  return {
    name: "halbestunde",
    async processImage(image: string | Uint8Array): Promise<string> {
      // Convert to base64 if Uint8Array
      const base64 =
        image instanceof Uint8Array
          ? btoa(String.fromCharCode(...image))
          : image;

      // TODO: Replace with actual Halbestunde API endpoint
      const response = await fetch("https://api.halbestunde.com/v1/omr", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64, format: "musicxml" }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Halbestunde API error (${response.status}): ${errorBody}`
        );
      }

      const result = await response.json();
      return result.musicxml;
    },
  };
}

// ─── Provider Factory ───────────────────────────────────────────────

function getProvider(): OmrProvider {
  const providerName = (
    Deno.env.get("OMR_PROVIDER") ?? "mock"
  ).toLowerCase();

  switch (providerName) {
    case "halbestunde":
      return createHalbestundeProvider();
    case "mock":
    default:
      return mockProvider;
  }
}

// ─── Request Handler ────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { imageBase64, imageUrl } = body as {
      imageBase64?: string;
      imageUrl?: string;
    };

    if (!imageBase64 && !imageUrl) {
      return new Response(
        JSON.stringify({
          error: "Either imageBase64 or imageUrl must be provided",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If imageUrl provided, fetch the image and convert to base64
    let imageData: string;
    if (imageUrl) {
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch image from URL: ${imgResponse.status}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const buffer = await imgResponse.arrayBuffer();
      imageData = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    } else {
      imageData = imageBase64!;
    }

    const provider = getProvider();
    const musicXml = await provider.processImage(imageData);

    return new Response(
      JSON.stringify({ musicXml, provider: provider.name }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[omr-process] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

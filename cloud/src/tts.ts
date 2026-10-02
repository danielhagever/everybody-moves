// The coach's voice: Deepgram Aura-2 on Workers AI, cached at the edge per sentence (the TV says
// the same cues every session), with MeloTTS as a fallback. Served as GET so the TV's media
// player can stream it from a plain URL.

const SPEAKER = "thalia";

export async function speech(env: { AI: Ai }, text: string, force?: string | null): Promise<Response> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 600);
  if (!clean) return new Response("empty", { status: 400 });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("coach|" + clean));
  const key = new Request("https://tts.cache/everybody-moves/" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""));
  const cache = (caches as any).default as Cache;
  const hit = force ? null : await cache.match(key);
  if (hit) return hit;
  let audio: ArrayBuffer | null = null;
  let voice = "aura-2";
  if (force !== "melotts") try {
    const r: any = await env.AI.run("@cf/deepgram/aura-2-en" as any, { text: clean, speaker: SPEAKER, encoding: "mp3" } as any, { returnRawResponse: true } as any);
    if (r instanceof Response && r.ok) audio = await r.arrayBuffer();
  } catch {}
  if (!audio || audio.byteLength < 500) {
    voice = "melotts";
    try {
      const r: any = await env.AI.run("@cf/myshell-ai/melotts" as any, { prompt: clean, lang: "en" } as any);
      if (r?.audio) audio = Uint8Array.from(atob(r.audio), (c) => c.charCodeAt(0)).buffer;
    } catch {}
  }
  if (!audio || audio.byteLength < 500) return new Response("tts unavailable", { status: 503 });
  const res = new Response(audio, { headers: { "content-type": voice === "aura-2" ? "audio/mpeg" : "audio/wav", "cache-control": "public, max-age=2592000", "x-voice": voice } });
  if (!force) await cache.put(key, res.clone());
  return res;
}

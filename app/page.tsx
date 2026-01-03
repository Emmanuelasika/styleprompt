"use client";

import { useState, useRef } from "react";
import { Upload, Video, Sparkles, Loader2, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

export default function Home() {
  const [styleVideo, setStyleVideo] = useState<File | null>(null);
  const [targetVideo, setTargetVideo] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styleInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 90 * 1024 * 1024) { // 90MB warning
        setError(`Warning: ${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB. It might exceed server limits (100MB).`);
      } else {
        setError(null);
      }
      setter(file);
    }
  };

  const handleGenerate = async () => {
    if (!styleVideo || !targetVideo) {
      setError("Please upload both videos.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("styleVideo", styleVideo);
    formData.append("targetVideo", targetVideo);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();

      // Try to parse as JSON, but handle raw text gracefully
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // If not valid JSON, treat the raw text as the error
        throw new Error(text || "Something went wrong");
      }

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black pointer-events-none" />

      <main className="relative z-10 container mx-auto px-4 py-12 max-w-4xl flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-purple-300 mb-6 backdrop-blur-md">
            <Sparkles className="w-4 h-4" />
            <span>Powered by Gemini 3 Pro</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 mb-6">
            Style Transfer Video
          </h1>
          <p className="text-lg text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Transform your videos with cinematic styles. Upload a reference and a target to generate the perfect prompt.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 w-full mb-12">
          {/* Style Video Input */}
          <VideoInputCard
            title="Style Reference"
            description="The look & feel you want to copy"
            file={styleVideo}
            inputRef={styleInputRef}
            onChange={(e) => handleFileChange(e, setStyleVideo)}
            color="purple"
          />

          {/* Target Video Input */}
          <VideoInputCard
            title="Target Output"
            description="The content you want to transform"
            file={targetVideo}
            inputRef={targetInputRef}
            onChange={(e) => handleFileChange(e, setTargetVideo)}
            color="blue"
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full flex justify-center mb-12"
        >
          <button
            onClick={handleGenerate}
            disabled={loading || !styleVideo || !targetVideo}
            className={clsx(
              "group relative px-8 py-4 rounded-full text-lg font-medium transition-all duration-300",
              loading || !styleVideo || !targetVideo
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-white text-black hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
            )}
          >
            <span className="flex items-center gap-3">
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing with Gemini...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 transition-transform group-hover:rotate-12" />
                  Generate Style Prompt
                </>
              )}
            </span>
          </button>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full mb-8 bg-red-500/10 border border-red-500/20 text-red-200 px-6 py-4 rounded-2xl text-center"
            >
              {error}
            </motion.div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-10 shadow-2xl"
            >
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </span>
                Generated Prompt
              </h2>
              <div className="bg-black/50 rounded-xl p-6 font-mono text-sm text-zinc-300 leading-relaxed overflow-x-auto border border-white/5">
                <pre className="whitespace-pre-wrap font-sans">{result}</pre>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="text-sm text-zinc-500 hover:text-white transition-colors"
                >
                  Copy to clipboard
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function VideoInputCard({
  title,
  description,
  file,
  inputRef,
  onChange,
  color,
}: {
  title: string;
  description: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  color: "purple" | "blue";
}) {
  const [preview, setPreview] = useState<string | null>(null);

  // Update preview when file changes
  if (file && !preview) {
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  return (
    <motion.div
      whileHover={{ y: -5 }}
      onClick={() => inputRef.current?.click()}
      className={clsx(
        "cursor-pointer group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10 p-1 min-h-[300px] flex flex-col",
        color === "purple" ? "hover:border-purple-500/50" : "hover:border-blue-500/50"
      )}
    >
      <input
        type="file"
        accept="video/*"
        className="hidden"
        ref={inputRef}
        onChange={(e) => {
          setPreview(null); // Reset preview to force update
          onChange(e);
        }}
      />

      {file && preview ? (
        <div className="relative w-full flex-1 rounded-[20px] overflow-hidden bg-black">
          <video
            src={preview}
            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
            muted
            loop
            onMouseOver={(e) => e.currentTarget.play()}
            onMouseOut={(e) => e.currentTarget.pause()}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-current" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-sm font-medium truncate">{file.name}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-[20px] border border-dashed border-white/10 group-hover:border-white/20 transition-colors">
          <div className={clsx(
            "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 duration-500",
            color === "purple" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
          )}>
            <Video className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{title}</h3>
          <p className="text-sm text-zinc-500">{description}</p>
        </div>
      )}
    </motion.div>
  );
}

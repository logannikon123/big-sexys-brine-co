"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Send, AlertCircle, Loader2, Trophy } from "lucide-react";

const contestSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  pun: z.string().min(5, "Your pun must be at least 5 characters"),
  honeypot: z.string().max(0),
});

type ContestFormData = z.infer<typeof contestSchema>;

export function ContestForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContestFormData>({
    resolver: zodResolver(contestSchema),
    defaultValues: {
      honeypot: "",
    },
  });

  async function onSubmit(data: ContestFormData) {
    if (data.honeypot) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/contest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          pun: data.pun,
        }),
      });

      if (!res.ok) throw new Error("Failed to send");
      setStatus("success");
      reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-8 text-center space-y-3">
        <Trophy size={48} className="mx-auto text-brand-gold" />
        <h3 className="font-display text-xl font-semibold text-brand-cream">
          Pun Submitted!
        </h3>
        <p className="text-brand-cream/60">
          Nice one! We&apos;ll be in touch if your pun takes the pickle crown.
          Good luck!
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="text-brand-orange hover:text-brand-gold font-semibold transition-colors"
        >
          Submit another pun
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Honeypot */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <input type="text" {...register("honeypot")} tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contest-name" className="text-brand-cream/80">Name</Label>
        <Input
          id="contest-name"
          placeholder="Your name"
          {...register("name")}
          className={cn(
            "bg-card border-brand-brown/30 text-brand-cream placeholder:text-brand-cream/30",
            errors.name && "border-brand-red"
          )}
        />
        {errors.name && (
          <p className="text-xs text-brand-red">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contest-email" className="text-brand-cream/80">Email</Label>
        <Input
          id="contest-email"
          type="email"
          placeholder="your@email.com"
          {...register("email")}
          className={cn(
            "bg-card border-brand-brown/30 text-brand-cream placeholder:text-brand-cream/30",
            errors.email && "border-brand-red"
          )}
        />
        {errors.email && (
          <p className="text-xs text-brand-red">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contest-pun" className="text-brand-cream/80">Your Best Pickle Pun</Label>
        <Textarea
          id="contest-pun"
          placeholder="Hit us with your best dill..."
          rows={4}
          {...register("pun")}
          className={cn(
            "bg-card border-brand-brown/30 text-brand-cream placeholder:text-brand-cream/30 resize-none",
            errors.pun && "border-brand-red"
          )}
        />
        {errors.pun && (
          <p className="text-xs text-brand-red">{errors.pun.message}</p>
        )}
      </div>

      {status === "error" && (
        <div className="flex items-center gap-2 text-brand-red text-sm">
          <AlertCircle size={16} />
          Something went wrong. Please try again.
        </div>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center gap-2 w-full justify-center px-6 py-3 bg-brand-orange text-white font-semibold rounded-full hover:bg-brand-orange/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "sending" ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send size={18} />
            Submit My Pun
          </>
        )}
      </button>
    </form>
  );
}

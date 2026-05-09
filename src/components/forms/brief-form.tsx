"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CONTENT_TYPE_LABELS } from "@/lib/validators/brief";
import { createRequest } from "@/server/actions/requests";
import { aiDraftBrief } from "@/server/actions/ai-draft";
import { Sparkles, Loader2 } from "lucide-react";

type Brand = { id: string; name: string };

interface BriefFormProps {
  brands: Brand[];
}

const CHANNEL_OPTIONS = ["Blog", "LinkedIn", "X", "Instagram", "Email", "YouTube", "Webinar", "Paid"];

export function BriefForm({ brands }: BriefFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [values, setValues] = useState({
    title: "",
    description: "",
    contentType: "BLOG",
    brandId: brands[0]?.id ?? "",
    priority: "MEDIUM",
    deadline: "",
    channels: [] as string[],
    targetAudience: "",
    keyMessages: "",
    callToAction: "",
    brandVoice: "",
    successMetrics: "",
    notes: "",
  });

  function update<K extends keyof typeof values>(key: K, val: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function toggleChannel(ch: string) {
    setValues((v) => ({
      ...v,
      channels: v.channels.includes(ch) ? v.channels.filter((c) => c !== ch) : [...v.channels, ch],
    }));
  }

  function aiFill() {
    setError(null);
    setAiHint(null);
    if (values.description.trim().length < 20) {
      setError("Add a fuller description first (at least a sentence).");
      return;
    }
    const fd = new FormData();
    fd.set("description", values.description);
    startAi(async () => {
      const res = await aiDraftBrief(fd);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      const d = res.draft;
      setValues((v) => ({
        ...v,
        title: d.title || v.title,
        contentType: d.contentType || v.contentType,
        targetAudience: d.targetAudience || v.targetAudience,
        keyMessages: (d.keyMessages ?? []).join("\n"),
        callToAction: d.callToAction || v.callToAction,
        brandVoice: d.brandVoice || v.brandVoice,
        successMetrics: (d.successMetrics ?? []).join("\n"),
        channels: d.channels?.length ? d.channels : v.channels,
      }));
      const hints: string[] = [];
      if (d.deadlineHint) hints.push(`Deadline hint: ${d.deadlineHint}`);
      if (d.openQuestions?.length) hints.push(`Open questions: ${d.openQuestions.join(" · ")}`);
      setAiHint(hints.length ? hints.join(" · ") : null);
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createRequest(fd);
      if (res && "error" in res) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--color-primary)]" /> Describe what you want
          </CardTitle>
          <CardDescription>
            One paragraph. AI will draft the brief — you&apos;ll review and edit before submitting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            name="description"
            rows={4}
            placeholder="e.g. A whitepaper for B2B finance leaders on how AI is reshaping FP&A. Aimed at CFOs at mid-market companies. Should drive demo bookings."
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={aiFill} disabled={aiPending}>
              {aiPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Draft brief with AI
            </Button>
            {aiHint && <span className="text-xs text-[var(--color-muted-foreground)]">{aiHint}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The brief</CardTitle>
          <CardDescription>Refine the AI draft or fill manually.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Title" htmlFor="title" required>
              <Input
                id="title"
                name="title"
                value={values.title}
                onChange={(e) => update("title", e.target.value)}
                required
              />
            </Field>
            <Field label="Content type" htmlFor="contentType" required>
              <select
                id="contentType"
                name="contentType"
                value={values.contentType}
                onChange={(e) => update("contentType", e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
              >
                {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Brand" htmlFor="brandId">
              <select
                id="brandId"
                name="brandId"
                value={values.brandId}
                onChange={(e) => update("brandId", e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
              >
                <option value="">No brand</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority" htmlFor="priority">
              <select
                id="priority"
                name="priority"
                value={values.priority}
                onChange={(e) => update("priority", e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 text-sm"
              >
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>URGENT</option>
              </select>
            </Field>
            <Field label="Deadline" htmlFor="deadline">
              <Input
                id="deadline"
                type="date"
                name="deadline"
                value={values.deadline}
                onChange={(e) => update("deadline", e.target.value)}
              />
            </Field>
            <Field label="Channels" htmlFor="channels">
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {CHANNEL_OPTIONS.map((ch) => {
                  const active = values.channels.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`px-2.5 py-1 rounded-md border text-xs ${active ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}
                    >
                      {ch}
                    </button>
                  );
                })}
                {values.channels.map((ch) => (
                  <input key={ch} type="hidden" name="channels" value={ch} />
                ))}
              </div>
            </Field>
          </div>

          <Field label="Target audience" htmlFor="targetAudience" required>
            <Textarea
              id="targetAudience"
              name="targetAudience"
              rows={2}
              value={values.targetAudience}
              onChange={(e) => update("targetAudience", e.target.value)}
              required
            />
          </Field>

          <Field label="Key messages (one per line)" htmlFor="keyMessages" required>
            <Textarea
              id="keyMessages"
              name="keyMessages"
              rows={4}
              value={values.keyMessages}
              onChange={(e) => update("keyMessages", e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Call to action" htmlFor="callToAction">
              <Input
                id="callToAction"
                name="callToAction"
                value={values.callToAction}
                onChange={(e) => update("callToAction", e.target.value)}
              />
            </Field>
            <Field label="Brand voice / tone" htmlFor="brandVoice">
              <Input
                id="brandVoice"
                name="brandVoice"
                value={values.brandVoice}
                onChange={(e) => update("brandVoice", e.target.value)}
              />
            </Field>
          </div>

          <Field label="Success metrics (one per line)" htmlFor="successMetrics">
            <Textarea
              id="successMetrics"
              name="successMetrics"
              rows={3}
              value={values.successMetrics}
              onChange={(e) => update("successMetrics", e.target.value)}
            />
          </Field>

          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              value={values.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 px-3 py-2 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Submit brief
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-[var(--color-destructive)]"> *</span>}
      </Label>
      {children}
    </div>
  );
}

"use client";

/* Screenshot-matched "Record Drop Reason" modal: a centered dialog (not the
   usual side Drawer) so the FC can churn through several trialled pieces in
   one pass — reason grid, curated sub-category chips, stylist notes, and a
   "Save Reason & Next Item" action that advances the queue. */

import { useEffect, useId, useRef, useState } from "react";
import { formatINR } from "@/lib/utils";
import type { ProductCardDTO, VisitWithProductsDTO } from "@/features/visits/products/dto";

type DropReason = VisitWithProductsDTO["dropReasons"][number];

/* Curated refinements per reason code. Free text always remains available
   via the stylist notes field; these are just the fast, one-tap common
   cases so the merchandising report stays consistent across stores. */
const SUBCATEGORIES: Record<string, string[]> = {
  SIZE: ["Too small", "Too large", "Wrong size on tag"],
  FIT: ["Tight on bust", "Too loose at waist", "Length too long", "Length too short"],
  COLOUR: ["Shade didn't suit", "Wanted a different colour", "Looked off in person"],
  DESIGN: ["Neckline / sleeve style", "Print or embroidery", "Too plain", "Too busy"],
  MATERIAL: ["Felt synthetic", "Too heavy", "Too sheer", "Uncomfortable texture"],
  PRICE: ["Above budget", "Found cheaper elsewhere", "Wanted a discount"],
  STYLE: ["Not right for the occasion", "Too traditional", "Too modern"],
  NOT_SUITABLE: ["Didn't like it on", "Family didn't approve", "Changed their mind"],
};

/* Screenshot copy differs slightly from the seeded DB label for NOT_SUITABLE
   ("Did not suit" vs "Didn't suit customer") — cosmetic only, the reports
   still key off the reason code, not this display string. */
const GRID_LABEL: Record<string, string> = {
  NOT_SUITABLE: "Didn't suit customer",
};

export interface DropModalState {
  card: ProductCardDTO;
  queue: ProductCardDTO[];
  index: number;
}

export function DropReasonModal({
  state,
  reasons,
  saving,
  onClose,
  onSave,
  onSkip,
}: {
  state: DropModalState;
  reasons: DropReason[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: { reasonId: string; subCategory: string | null; note: string }) => void;
  onSkip: () => void;
}) {
  const { card, queue, index } = state;
  const [reasonId, setReasonId] = useState("");
  const [subCategory, setSubCategory] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [listening, setListening] = useState(false);
  /* Fresh item → fresh selection. Render-phase sync (the documented pattern):
     an effect here would fire a cascading render on every opened card. */
  const [lastCardId, setLastCardId] = useState(card.id);
  if (lastCardId !== card.id) {
    setLastCardId(card.id);
    setReasonId("");
    setSubCategory(null);
    setNote("");
  }
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      recognitionRef.current?.stop();
    };
  }, [onClose]);

  const reason = reasons.find((r) => r.id === reasonId) ?? null;
  const subOptions = reason ? SUBCATEGORIES[reason.code] ?? [] : [];
  const isOther = reason?.code === "OTHER";
  const canSave = !!reasonId && (!isOther || note.trim().length > 0) && !saving;
  const hasNext = index < queue.length - 1;

  /* Optional: dictate the stylist note via the browser's speech API when the
     device offers it. Purely additive — the mic simply toggles listening;
     typing always works regardless of browser support. */
  const toggleMic = () => {
    type SpeechCtor = new () => {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const w = window as unknown as { webkitSpeechRecognition?: SpeechCtor; SpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const chunk = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
      if (chunk) setNote((cur) => (cur ? `${cur} ${chunk}` : chunk));
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const submit = () => {
    if (!canSave) return;
    onSave({ reasonId, subCategory, note: note.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(30,27,23,0.5)] p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fp-rise flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_-20px_rgba(30,27,23,0.45)] outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f1ece4] px-6 pt-5 pb-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[var(--fp-brand-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--fp-brand)]">
                Drop log · 2-click
              </span>
              {queue.length > 1 && (
                <span className="text-[12.5px] font-semibold text-[#7a736a]">Item {index + 1} of {queue.length}</span>
              )}
            </div>
            <h2 id={titleId} className="mt-2 text-[22px] font-bold tracking-tight text-[#211d18]">Record Drop Reason</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid min-h-10 min-w-10 shrink-0 place-items-center rounded-lg text-[#7a736a] hover:bg-[#f1ece4] hover:text-[#211d18]"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M5 5l10 10M15 5 5 15" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center gap-3 rounded-xl bg-[#f7f5f1] p-3">
            {card.product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- catalogue photos come from per-project storage hosts
              <img src={card.product.imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
            ) : (
              <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-lg bg-[#e7dfd3] text-[18px] font-bold text-[#a8a094]">{card.product.name.slice(0, 1)}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-[#211d18]">{card.product.name}</p>
              <p className="mt-0.5 truncate text-[12.5px] text-[#7a736a]">
                <span className="font-mono">{card.product.sku}</span> · Size {card.product.size}
              </p>
            </div>
            <p className="fp-num shrink-0 text-[17px] font-bold text-[#211d18]">{formatINR(card.product.price)}</p>
          </div>

          <p className="mt-5 text-[15px] font-bold text-[#211d18]">Why didn&apos;t the customer like this piece?</p>
          <p className="mt-1 text-[13px] text-[#7a736a]">Tap to classify the drop reason for automated merchandising feedback.</p>

          <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Drop reason">
            {reasons.map((r) => {
              const active = r.id === reasonId;
              const label = GRID_LABEL[r.code] ?? r.label;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => { setReasonId(r.id); setSubCategory(null); }}
                  className={`min-h-[52px] rounded-lg px-2 text-[13.5px] font-semibold transition-colors ${
                    active ? "bg-[#23403a] text-white" : "border border-[#e0d7c9] bg-white text-[#211d18] hover:border-[#211d18]"
                  }`}
                >
                  {active ? `✓ ${label}` : label}
                </button>
              );
            })}
          </div>

          {subOptions.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7a736a]">
                Sub-category for {(GRID_LABEL[reason!.code] ?? reason!.label).toLowerCase()}:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {subOptions.map((s) => {
                  const active = subCategory === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSubCategory((cur) => (cur === s ? null : s))}
                      className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition-colors ${
                        active ? "bg-[var(--fp-ok-bg)] text-[var(--fp-ok)]" : "bg-[#f1ece4] text-[#57534e] hover:bg-[#e7dfd3]"
                      }`}
                    >
                      {active && "✓ "}{s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label htmlFor="drop-stylist-note" className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7a736a]">
                Stylist notes {!isOther && "(optional)"}
              </label>
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? "Stop dictation" : "Dictate note"}
                title={listening ? "Listening…" : "Dictate"}
                className={`grid size-8 place-items-center rounded-full ${listening ? "bg-[var(--fp-brand)] text-white" : "text-[#7a736a] hover:bg-[#f1ece4]"}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
                </svg>
              </button>
            </div>
            <div className="relative mt-1.5">
              <textarea
                id="drop-stylist-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                autoFocus={isOther}
                placeholder={isOther ? "Tell us in your words — it goes to the vendor report." : "e.g. Customer loved the colour, needs 2 inches hemmed"}
                className="w-full rounded-lg border border-[#e0d7c9] bg-white px-3 py-2.5 pr-9 text-[14.5px] text-[#211d18] placeholder:text-[#a8a094] focus:border-[#211d18] focus:outline-none"
              />
              {note && (
                <button
                  type="button"
                  onClick={() => setNote("")}
                  aria-label="Clear note"
                  className="absolute right-2 top-2.5 grid size-6 place-items-center rounded text-[#a8a094] hover:bg-[#f1ece4] hover:text-[#211d18]"
                >
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M5 5l10 10M15 5 5 15" /></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[#f1ece4] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-lg bg-[#f1ece4] px-4 text-[14px] font-bold text-[#211d18] hover:bg-[#e7dfd3]"
          >
            Cancel
          </button>
          {queue.length > 1 && (
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex min-h-11 items-center px-2 text-[13.5px] font-semibold text-[#7a736a] hover:text-[#211d18]"
            >
              Skip this item
            </button>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={submit}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#23403a] px-5 text-[14px] font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : hasNext ? "Save Reason & Next Item" : "Save Reason"}
            {!saving && <span aria-hidden>→</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { Meter } from "@base-ui/react/meter";

interface WiserdMeterProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  formattedValue?: string;
  helperText?: string;
  tone?: "blue" | "success" | "violet";
}

/**
 * Functional numerical range indicator powered by Base UI Meter (@base-ui/react/meter).
 * Strictly for numeric ranges (profile completion, storage usage, monthly listing quotas) —
 * never used to represent sequential escrow or order fulfillment stages.
 */
export function WiserdMeter({
  label,
  value,
  min = 0,
  max = 100,
  formattedValue,
  helperText,
  tone = "blue",
}: WiserdMeterProps) {
  const clamped = Math.max(min, Math.min(max, value));

  return (
    <div className="space-y-1.5">
      <Meter.Root
        className="wiserd-meter-root"
        value={clamped}
        min={min}
        max={max}
      >
        <Meter.Label className="wiserd-meter-label">{label}</Meter.Label>
        <Meter.Value className="wiserd-meter-value">
          {() =>
            formattedValue ||
            `${Math.round(((clamped - min) / Math.max(1, max - min)) * 100)}%`
          }
        </Meter.Value>
        <Meter.Track className="wiserd-meter-track">
          <Meter.Indicator
            className="wiserd-meter-indicator"
            data-tone={tone}
          />
        </Meter.Track>
      </Meter.Root>
      {helperText && (
        <p className="text-xs leading-relaxed text-[#6B6B6B]">{helperText}</p>
      )}
    </div>
  );
}

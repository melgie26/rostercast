import { calculateSms } from "./segments.js";

export function calculateTransmittedMessage({ body = "", prefix = "", suffix = "", recipientCount = 0 }) {
  const transmittedText = `${prefix}${body}${suffix}`;
  const calculation = calculateSms(transmittedText);
  return {
    body_characters: [...body].length,
    required_characters: [...`${prefix}${suffix}`].length,
    transmitted_characters: [...transmittedText].length,
    transmitted_text: transmittedText,
    recipient_count: recipientCount,
    total_sms_segments: calculation.segments * recipientCount,
    administrator_summary: `${calculation.encodedUnits} / ${calculation.current_capacity} characters · ${calculation.segments} SMS`,
    ...calculation
  };
}


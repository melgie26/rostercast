import test from "node:test";
import assert from "node:assert/strict";
import { calculateSms } from "../js/sms/segments.js";
import { calculateTransmittedMessage } from "../js/sms/transmitted-message.js";

test("GSM-7 single and multipart boundaries", () => {
  assert.equal(calculateSms("a".repeat(160)).segments, 1);
  assert.equal(calculateSms("a".repeat(161)).segments, 2);
  assert.equal(calculateSms("a".repeat(306)).segments, 2);
  assert.equal(calculateSms("a".repeat(307)).segments, 3);
});

test("GSM extension characters consume two septets", () => {
  const result = calculateSms("^".repeat(80));
  assert.equal(result.encoding, "GSM-7");
  assert.equal(result.encodedUnits, 160);
  assert.equal(result.segments, 1);
  assert.equal(calculateSms("^".repeat(81)).segments, 2);
});

test("Unicode uses 70 and 67 code-unit capacities", () => {
  assert.equal(calculateSms("漢".repeat(70)).segments, 1);
  assert.equal(calculateSms("漢".repeat(71)).segments, 2);
  assert.equal(calculateSms("漢".repeat(134)).segments, 2);
  assert.equal(calculateSms("漢".repeat(135)).segments, 3);
});

test("emoji uses two UCS-2 code units and yields a plain-language explanation", () => {
  const result = calculateSms("Reminder 🔥");
  assert.equal(result.encoding, "UCS-2");
  assert.equal(result.code_units, result.characters + 1);
  assert.match(result.explanation, /reducing a single SMS from 160 to 70/);
});

test("required text is included in transmitted usage", () => {
  const result = calculateTransmittedMessage({ body: "A".repeat(153), prefix: "APFFA: ", recipientCount: 82 });
  assert.equal(result.transmitted_characters, 160);
  assert.equal(result.segments, 1);
  assert.equal(result.total_sms_segments, 82);
  assert.equal(calculateTransmittedMessage({ body: "A".repeat(154), prefix: "APFFA: ", recipientCount: 82 }).segments, 2);
});


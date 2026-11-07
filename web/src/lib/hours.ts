// "7am", "12pm", "6pm". Client-safe.
export function hourLabel(h: number) {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${h < 12 ? "am" : "pm"}`;
}

/**
 * Official brand logo SVG components for store integrations.
 * Instacart path: Simple Icons (MIT). Walmart/Amazon: simplified from official brand marks.
 */

// Instacart carrot — from Simple Icons MIT dataset
const INSTACART_PATH =
  "M15.629 9.619c1.421 1.429 2.58 3.766 1.917 5.152-1.778 3.715-8.002 5.25-10.93 2.584-2.262-2.04-1.72-5.61.7-7.295 2.198-1.554 5.245-1.44 7.328.013a.364.364 0 0 0 .516-.098.364.364 0 0 0-.098-.516c-2.354-1.636-5.786-1.778-8.245-.058-2.853 2.016-3.508 6.3-.867 8.743 3.424 3.088 10.395 1.349 12.4-2.83.833-1.74-.46-4.42-2.087-6.062a.364.364 0 0 0-.515.001.364.364 0 0 0-.119.366zm-4.83-4.506c-1.01-.134-2.09.02-3.046.438a.364.364 0 0 0-.179.484.364.364 0 0 0 .484.179c.84-.37 1.78-.506 2.654-.391.875.114 1.712.458 2.352 1.038a.364.364 0 0 0 .515-.025.364.364 0 0 0-.025-.515 5.32 5.32 0 0 0-2.755-1.208zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 1.5c5.799 0 10.5 4.701 10.5 10.5S17.799 22.5 12 22.5 1.5 17.799 1.5 12 6.201 1.5 12 1.5z";

// Walmart 6-spoke spark (official brand mark shape)
const WALMART_PATH =
  "M12 2.25a1.125 1.125 0 0 1 1.125 1.125v4.125a1.125 1.125 0 0 1-2.25 0V3.375A1.125 1.125 0 0 1 12 2.25zm0 14.25a1.125 1.125 0 0 1 1.125 1.125v4.125a1.125 1.125 0 0 1-2.25 0v-4.125A1.125 1.125 0 0 1 12 16.5zM2.25 12a1.125 1.125 0 0 1 1.125-1.125h4.125a1.125 1.125 0 0 1 0 2.25H3.375A1.125 1.125 0 0 1 2.25 12zm14.25 0a1.125 1.125 0 0 1 1.125-1.125h4.125a1.125 1.125 0 0 1 0 2.25h-4.125A1.125 1.125 0 0 1 16.5 12zM4.732 4.732a1.125 1.125 0 0 1 1.59 0l2.918 2.918a1.125 1.125 0 0 1-1.59 1.59L4.732 6.322a1.125 1.125 0 0 1 0-1.59zm10.028 10.028a1.125 1.125 0 0 1 1.59 0l2.918 2.918a1.125 1.125 0 0 1-1.59 1.59l-2.918-2.918a1.125 1.125 0 0 1 0-1.59zM19.268 4.732a1.125 1.125 0 0 1 0 1.59l-2.918 2.918a1.125 1.125 0 0 1-1.59-1.59l2.918-2.918a1.125 1.125 0 0 1 1.59 0zM9.24 14.76a1.125 1.125 0 0 1 0 1.59l-2.918 2.918a1.125 1.125 0 0 1-1.59-1.59l2.918-2.918a1.125 1.125 0 0 1 1.59 0z";

// Amazon smile-arrow mark
const AMAZON_PATH =
  "M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.525.13.12.174.09.336-.1.48-.643.556-1.355 1.03-2.14 1.43-2.flere.534 1.208-.31-1.697-.468-3.488-.57l-.165-.011c-3.4-.225-6.666.274-9.804 1.495-1.213.47-2.36 1.033-3.443 1.69-.16.098-.27.09-.343-.02a.254.254 0 0 1 .036-.32l.158-.153zm7.24-14.41c0-1.006.448-1.508 1.344-1.508.896 0 1.344.502 1.344 1.507v6.7c0 1.006-.448 1.508-1.344 1.508-.896 0-1.344-.502-1.344-1.507v-6.7zm5.28 0c0-1.006.447-1.508 1.344-1.508.896 0 1.344.502 1.344 1.507v6.7c0 1.006-.448 1.508-1.344 1.508-.897 0-1.344-.502-1.344-1.507v-6.7z";

export function InstacartLogo({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="Instacart">
      <path d={INSTACART_PATH} />
    </svg>
  );
}

export function WalmartLogo({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="Walmart">
      <path d={WALMART_PATH} />
    </svg>
  );
}

export function AmazonLogo({ className }: { className?: string }) {
  // Wordmark-style: "amazon" text + smile arrow (cleaner than icon at small sizes)
  return (
    <svg role="img" viewBox="0 0 80 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-label="Amazon Fresh">
      <text x="2" y="17" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="700" letterSpacing="-0.5">amazon</text>
      {/* Smile arrow */}
      <path d="M4 20.5 Q24 24.5 52 20.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M50 18.5 L53 20.5 L50 22" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

import { BeautifyWorkspace } from "@/components/beautify-workspace";

export default function HomePage() {
  return (
    <div className="relative min-h-[calc(100vh-9rem)] overflow-hidden px-4 py-12 sm:py-16">
      <div
        aria-hidden
        className="absolute inset-0 pattern-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]"
      />
      <BeautifyWorkspace />
    </div>
  );
}

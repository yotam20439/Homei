import HouseLoader from "@/components/HouseLoader";

export default function Loading() {
  return (
    <main className="page loading-page" aria-busy="true">
      <HouseLoader size={84} label="רגע, מסדרים את הבית…" />
    </main>
  );
}

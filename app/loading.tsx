import HouseLoader from "@/components/HouseLoader";

export default function Loading() {
  return (
    <main className="auth loading-page" aria-busy="true">
      <HouseLoader size={84} />
    </main>
  );
}

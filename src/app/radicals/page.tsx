import ItemsBrowser from "@/app/components/ItemsBrowser";

export default function RadicalsPage() {
  return (
    <ItemsBrowser
      apiUrl="/api/radicals"
      title="Radicals"
      itemType="radical"
    />
  );
}

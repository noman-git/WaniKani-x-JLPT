import ItemsBrowser from "@/app/components/ItemsBrowser";

export default function VocabPage() {
  return (
    <ItemsBrowser
      apiUrl="/api/vocab"
      title="Vocabulary"
      itemType="vocab"
    />
  );
}

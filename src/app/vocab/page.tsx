import ItemsBrowser from "@/app/components/ItemsBrowser";

export default function VocabPage() {
  return (
    <ItemsBrowser
      apiUrl="/api/items?type=vocab"
      title="Vocabulary"
      itemType="vocab"
    />
  );
}

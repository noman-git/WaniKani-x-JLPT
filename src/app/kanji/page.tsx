import ItemsBrowser from "@/app/components/ItemsBrowser";

export default function KanjiPage() {
  return (
    <ItemsBrowser
      apiUrl="/api/items?type=kanji"
      title="Kanji"
      itemType="kanji"
    />
  );
}

import { Container, Text, Card } from "@yamada-ui/react";
import { H } from "@/ui/structure/h";
import { Fragment } from "react";

const informationData = [
  {
    title: "このサイトは？",
    content: [
      "楽天市場で開催される、お買い物マラソンの楽天ポイント還元率を計算するサイトです。",
      "お得に商品を買いたいあなたのポイ活を応援します！",
    ],
  },
  {
    title: "使い方は金額を打ち込むだけ！",
    content: [
      "あといくら購入できるのかが可視化され、計画的なお買い物に役立ちます。",
      "SPUや0と5のつく日などの定番キャンペーンにも対応。",
      "購入画面では分かりづらかった、実際のおトク額がわかります！",
    ],
  },
  {
    title: "ブラウザを閉じてもデータが保持",
    content: [
      "入力途中で離脱しても次回アクセス時に続きから入力できます。",
      "ローカルに保持されるため外部に送信されることはありません。",
    ],
  },
  {
    title: "サイト利用上の注意事項",
    content: [
      "実際に付与されるポイントには誤差が出る可能性があります。",
      "参考としてご利用ください。",
      "また、当サイトではサイト運営費用を賄うためにGoogle Adsenseと楽天アフィリエイトを利用しています。",
    ],
  },
];

/**
 * このサイトについての情報
 */
export const SiteDescription = () => {
  return (
    <Container as={Card}>
      {informationData.map((section) => (
        <Fragment key={section.title}>
          <H>{section.title}</H>
          <section>
            {section.content.map((paragraph) => (
              <Text key={paragraph}>{paragraph}</Text>
            ))}
          </section>
        </Fragment>
      ))}
    </Container>
  );
};

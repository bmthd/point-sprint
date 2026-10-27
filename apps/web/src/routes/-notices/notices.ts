/** A notice that raises the site's version, shown in the header. */
export type Release = {
  /** `major.minor`, as `1.0`. */
  version: string;
  /** Whether the same orders give other points from this version: the calculation or Rakuten's rules changed. */
  changesCalculation: boolean;
};

export type Notice = {
  /** The anchor of the notice on `/notices`: lowercase letters, digits and hyphens. */
  id: string;
  /** The day it was posted, as `YYYY-MM-DD` in Japan. */
  date: string;
  title: string;
  /** Plain text. A blank line starts a new paragraph. */
  body: string;
  /** Present when the notice raises the version. */
  release?: Release;
};

export type ReleaseNotice = Notice & { release: Release };

/**
 * Every notice. Adding one here is all it takes: `/notices` and the sidebar put them newest first,
 * whatever the order here.
 */
export const notices: readonly Notice[] = [
  {
    id: "calculation-page",
    date: "2026-10-25",
    title: "計算方法のページを公開し、変更履歴を始めました",
    body: `ポイントの計算方法を「計算方法」のページにまとめました。計算の流れを例で追えるほか、SPU やキャンペーンの倍率と上限を、楽天の公式ページへのリンクと確かめた日とともに載せています。計算に入れていないものもまとめました。

これからは、計算の直しや楽天の規則の変更、新しい機能を、このお知らせにバージョン番号を付けて載せます。計算の結果が変わる変更では、大きい番号（Ver.1.x から Ver.2.0）を上げます。いまのバージョンと更新した日は、画面の上に出ています。`,
    release: { version: "1.0", changesCalculation: false },
  },
  {
    id: "sync",
    date: "2026-10-26",
    title: "PC とスマホで同じデータを使えるようになりました",
    body: `プロフィールの「ほかの端末と同期」から、パスキーでログインすると、PC とスマホで同じプランと注文を使えます。名前やメールアドレス、パスワードは使いません。

データは端末の中で暗号にしてから送るので、運営者も中身を読めません。始めたときに出る復元用のコードは、パスワード管理アプリやメモに控えてください。

同期を使わない場合は、これまでどおり入力した内容はこのブラウザの中にだけ保存されます。あわせて、プライバシーポリシーと利用規約に同期についての項目を加えました。`,
  },
  {
    id: "rebuilt",
    date: "2026-10-08",
    title: "ポイントスプリントを作り直しました",
    body: `お買い物マラソンで買う予定の注文を並べると、獲得できるポイント、還元率、買いまわりの店舗数がその場で分かる計算ツールとして作り直しました。

プランはイベントごとにいくつでも作れます。達成している SPU とよく買うショップをプロフィールに登録しておくと、新しく作るプランに最初から入ります。

入力した内容はこのブラウザの中にだけ保存されます。使い方は「使い方・注意事項」をご覧ください。`,
  },
];

/** Newest first. Notices of the same day keep the order they are listed in. */
export function newestFirst(list: readonly Notice[]): Notice[] {
  return list.toSorted((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** The paragraphs of a notice's body. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}

const versionParts = (version: string) => {
  const [major = 0, minor = 0] = version.split(".").map(Number);
  return { major, minor };
};

/** Negative when `a` is the older version. */
const compareVersions = (a: string, b: string): number => {
  const [x, y] = [versionParts(a), versionParts(b)];
  return x.major - y.major || x.minor - y.minor;
};

/**
 * The version after `previous`: the major number goes up when the calculation changes, the minor
 * one otherwise. The first is `1.0`.
 */
export function nextVersion(previous: string | undefined, changesCalculation: boolean): string {
  if (previous === undefined) return "1.0";
  const { major, minor } = versionParts(previous);
  return changesCalculation ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

const isRelease = (notice: Notice): notice is ReleaseNotice => notice.release !== undefined;

/** The notices that raise the version, oldest version first. */
export function releasesOldestFirst(list: readonly Notice[]): ReleaseNotice[] {
  return list
    .filter(isRelease)
    .toSorted((a, b) => compareVersions(a.release.version, b.release.version));
}

/** The notice of the current version, or `undefined` when none raised it. */
export function latestRelease(list: readonly Notice[]): ReleaseNotice | undefined {
  return releasesOldestFirst(list).at(-1);
}

/** How many days a release counts as recent in the header. */
export const FRESH_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether `today` (`YYYY-MM-DD`) is within `FRESH_DAYS` of the release. */
export function isFreshRelease(release: ReleaseNotice, today: string): boolean {
  return (
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${release.date}T00:00:00Z`)) / DAY_MS <=
    FRESH_DAYS
  );
}

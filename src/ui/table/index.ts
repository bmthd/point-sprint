import { FieldMetadata } from "@conform-to/react";
import { RowData } from "@yamada-ui/table";

/**
 * テーブルに実装されるべき振る舞いを定義する
 */
export interface Operation<T> {
  /**
   * テーブルの行を追加する
   * @param data 追加するデータ
   */
  add?: (data?: Partial<T>) => void;
  /**
   * テーブルの行を削除する
   * @param index 削除する行のインデックス
   */
  remove?: (index: number) => void;
  /**
   * テーブルの行をリセットする
   */
  reset?: () => void;
  /**
   * テーブルの行を永続化する
   */
  save?: () => void;
  /**
   * テーブルの行を移動する
   * @param from 移動元のインデックス
   * @param to 移動先のインデックス
   */
  move?: (from: number, to: number) => void;
}

declare module "@tanstack/table-core" {
  interface TableMeta<TData extends RowData>
    extends Operation<TData extends FieldMetadata<infer TItem> ? TItem : unknown> {}
}

import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import { noCallbackOnlySubscription } from "./jotai-plugin.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { sourceType: "module", parserOptions: { lang: "tsx" } },
});

const error = (hook: string) => ({ messageId: "callbackOnly", data: { hook } });

tester.run("no-callback-only-subscription", noCallbackOnlySubscription, {
  valid: [
    {
      name: "the value is drawn in JSX",
      code: `function Name() {
        const name = useAtomValue(nameAtom);
        return <p>{name}</p>;
      }`,
    },
    {
      name: "the value is computed while rendering",
      code: `function Total() {
        const items = useAtomValue(itemsAtom);
        const total = items.length;
        return <p>{total}</p>;
      }`,
    },
    {
      name: "a handler reads the value that JSX also draws",
      code: `function Name() {
        const name = useAtomValue(nameAtom);
        return <button onClick={() => alert(name)}>{name}</button>;
      }`,
    },
    {
      name: "the value is a dependency of an effect",
      code: `function Title() {
        const title = useAtomValue(titleAtom);
        useEffect(() => {
          document.title = title;
        }, [title]);
        return null;
      }`,
    },
    {
      name: "useMemo computes from the value while rendering",
      code: `function Total() {
        const items = useAtomValue(itemsAtom);
        const total = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);
        return <p>{total}</p>;
      }`,
    },
    {
      name: "map draws each item while rendering",
      code: `function List() {
        const items = useAtomValue(itemsAtom);
        return <ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>;
      }`,
    },
    {
      name: "a render prop draws the value",
      code: `function Name() {
        const name = useAtomValue(nameAtom);
        return <Field render={() => <p>{name}</p>} />;
      }`,
    },
    {
      name: "a local function draws the value and is called while rendering",
      code: `function Name() {
        const name = useAtomValue(nameAtom);
        const label = () => name.toUpperCase();
        return <p>{label()}</p>;
      }`,
    },
    {
      name: "a hook returns the value",
      code: `function useName() {
        const name = useAtomValue(nameAtom);
        return name;
      }`,
    },
    {
      name: "useAtom draws its value; the setter goes to a handler",
      code: `function Counter() {
        const [count, setCount] = useAtom(countAtom);
        return <button onClick={() => setCount(count + 1)}>{count}</button>;
      }`,
    },
    {
      name: "useAtom whose value is not read",
      code: `function Reset() {
        const [, setCount] = useAtom(countAtom);
        return <button onClick={() => setCount(0)}>reset</button>;
      }`,
    },
    {
      name: "useSetAtom is not a subscription",
      code: `function Save() {
        const save = useSetAtom(saveAtom);
        return <button onClick={() => save()}>save</button>;
      }`,
    },
  ],
  invalid: [
    {
      name: "only an inline handler reads the value",
      code: `function ExportButton() {
        const saveFile = useAtomValue(saveFileAtom);
        return <button onClick={() => saveFile.save("a.json", "{}")}>export</button>;
      }`,
      errors: [error("useAtomValue")],
    },
    {
      name: "only a handler declared in the component reads the value",
      code: `function ExportButton() {
        const saveFile = useAtomValue(saveFileAtom);
        function handleClick() {
          saveFile.save("a.json", "{}");
        }
        return <button onClick={handleClick}>export</button>;
      }`,
      errors: [error("useAtomValue")],
    },
    {
      name: "a destructured value read only in a handler",
      code: `function ExportButton() {
        const { save } = useAtomValue(saveFileAtom);
        const handleClick = () => save("a.json", "{}");
        return <button onClick={handleClick}>export</button>;
      }`,
      errors: [error("useAtomValue")],
    },
    {
      name: "the first value of useAtom read only in a handler",
      code: `function Counter() {
        const [count, setCount] = useAtom(countAtom);
        return <button onClick={() => setCount(count + 1)}>+1</button>;
      }`,
      errors: [error("useAtom")],
    },
    {
      name: "a hook returns only a callback that reads the value",
      code: `function useExport() {
        const saveFile = useAtomValue(saveFileAtom);
        return { exportAll: () => saveFile.save("a.json", "{}") };
      }`,
      errors: [error("useAtomValue")],
    },
  ],
});

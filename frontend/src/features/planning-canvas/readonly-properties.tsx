export type ReadOnlyProperty = {
  key: string;
  label: string;
  value: string | number | null;
  source?: string;
};
export function ReadOnlyPropertyField({
  label,
  value,
  source,
}: Omit<ReadOnlyProperty, "key">) {
  return (
    <p className="canvas-readonly-property">
      <span role="textbox" aria-readonly="true" tabIndex={0} aria-label={label}>
        {label}：{value ?? "待解析"}
      </span>
      {source && <small>（{source}）</small>}
    </p>
  );
}
export function ReadOnlyProperties({ fields }: { fields: ReadOnlyProperty[] }) {
  return (
    <fieldset>
      <legend>只读属性</legend>
      {fields.map((field) => (
        <ReadOnlyPropertyField {...field} key={field.key} />
      ))}
    </fieldset>
  );
}

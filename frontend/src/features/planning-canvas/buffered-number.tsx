import { useEffect, useRef, useState } from "react";
export function BufferedNumber({value,min,max,onChange,allowEmpty=false,placeholder}: {
  value: number | null | undefined; min?: number; max?: number; onChange: (value: any) => void; allowEmpty?: boolean; placeholder?: string;
}) {
  const [text,setText] = useState(String(value ?? ""));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {if(document.activeElement !== input.current) setText(String(value ?? ""));},[value]);
  return <input ref={input} type="number" min={min} max={max} required={!allowEmpty} value={text} placeholder={placeholder}
    onChange={event => {
      const next=event.target.value;
      setText(next);
      event.target.setCustomValidity("");
      if(!next) {
        if(allowEmpty) onChange(null);
        return;
      }
      if(event.target.validity.valid) onChange(Number(next));
    }} />;
}

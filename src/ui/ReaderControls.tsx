import * as React from 'react';

export function ReaderControls({ fontSize, onFontSizeChange }: {
  fontSize: number;
  onFontSizeChange: (value: number) => void;
}) {
  return (
    <div style={{ padding: '10px' }}>
      <label htmlFor="fontSizeSlider">Adjust Font Size: </label>
      <input
        id="fontSizeSlider"
        type="range"
        min="80"
        max="160"
        value={fontSize}
        onChange={e => onFontSizeChange(parseInt(e.target.value))}
      />
    </div>
  );
}

import React from 'react';

interface NashSymbolProps {
  className?: string;
  size?: number;
}

const NashSymbol: React.FC<NashSymbolProps> = ({ className = '', size = 16 }) => {
  return (
    <span 
      className={`nash-symbol ${className}`}
      style={{ fontSize: `${size}px` }}
      title="Nash (𐆖)"
    >
      𐆖
    </span>
  );
};

export default NashSymbol;

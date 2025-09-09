import React from 'react';
import Image from 'next/image';

interface DenariusSymbolProps {
  className?: string;
  size?: number;
  color?: string;
}

const DenariusSymbol: React.FC<DenariusSymbolProps> = ({ 
  className = '', 
  size = 16, 
  color = 'currentColor' 
}) => {
  return (
    <span 
      className={`denarius-symbol ${className}`}
      style={{ 
        display: 'inline-block',
        verticalAlign: 'baseline',
        marginRight: '2px',
        marginLeft: '1px',
        width: `${size}px`,
        height: `${size}px`
      }}
    >
      <Image
        src="/denarius-symbol.svg"
        alt="Denarius symbol"
        width={size}
        height={size}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          filter: color !== 'currentColor' ? `brightness(0) saturate(100%) ${color}` : 'none'
        }}
      />
    </span>
  );
};

export default DenariusSymbol;

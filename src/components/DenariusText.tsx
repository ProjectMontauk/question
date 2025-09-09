import React from 'react';
import DenariusSymbolInline from './DenariusSymbolInline';

interface DenariusTextProps {
  children: React.ReactNode;
  className?: string;
  symbolSize?: number;
  symbolColor?: string;
}

const DenariusText: React.FC<DenariusTextProps> = ({ 
  children, 
  className = '',
  symbolSize = 16,
  symbolColor = 'currentColor'
}) => {
  // Replace 𐆖 with our custom symbol component
  const processText = (text: string) => {
    const parts = text.split('𐆖');
    const result = [];
    
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        result.push(
          <DenariusSymbolInline 
            key={`symbol-${i}`}
            size={symbolSize}
            color={symbolColor}
          />
        );
      }
      if (parts[i]) {
        result.push(parts[i]);
      }
    }
    
    return result;
  };

  if (typeof children === 'string') {
    return (
      <span className={className}>
        {processText(children)}
      </span>
    );
  }

  return <span className={className}>{children}</span>;
};

export default DenariusText;

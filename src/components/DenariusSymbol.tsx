import React from 'react';

interface DenariusSymbolProps {
  className?: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

const DenariusSymbol: React.FC<DenariusSymbolProps> = ({ 
  className = '', 
  size = 16, 
  color = 'currentColor',
  style = {}
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="2.7 2.1 6.2 6.7" 
      xmlns="http://www.w3.org/2000/svg"
      className={`denarius-symbol ${className}`}
      style={{ 
        display: 'inline-block',
        verticalAlign: 'baseline',
        ...style
      }}
    >
      <g>
        <path 
          d="M2.744 5.371c.071-.112.157-.235.258-.37.101-.131.191-.225.27-.281a.949.949 0 0 0 .404.236c.157.049.391.073.702.073H5.72l-.309.51H2.918Zm6.512-.174a5.783 5.783 0 0 1-.258.37 1.368 1.368 0 0 1-.27.282.949.949 0 0 0-.404-.236c-.157-.049-.391-.073-.702-.073H6.28l.309-.511h2.493zM9.13 2.18c-.273.03-.488.077-.645.14a.758.758 0 0 0-.382.332L5.997 6.014l-.314-.831 1.583-2.532c.101-.169.096-.283-.017-.343-.108-.06-.329-.103-.662-.13v-.297H9.13ZM6.716 8.956V8.66c.33-.034.535-.082.618-.146.086-.068.076-.176-.028-.326l-3.78-5.536c-.116-.165-.23-.276-.342-.332-.109-.056-.286-.103-.533-.14v-.3h2.7v.298c-.318.03-.526.075-.623.135-.097.06-.09.172.023.337L8.53 8.187a.963.963 0 0 0 .353.337c.128.06.302.105.523.135v.297Zm-2.263-.769c-.109.165-.112.28-.011.343.105.063.331.106.68.129v.297H2.593V8.66c.24-.019.446-.064.618-.135a.851.851 0 0 0 .404-.337l2.162-3.453.242.977Z"
          fill={color}
          stroke="none"
        />
      </g>
    </svg>
  );
};

export default DenariusSymbol;

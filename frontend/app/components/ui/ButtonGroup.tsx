import React from 'react';

interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

const ButtonGroup: React.FC<ButtonGroupProps> = ({ 
  children, 
  className = '',
  orientation = 'horizontal'
}) => {
  const orientationStyles = orientation === 'horizontal' 
    ? 'flex-row' 
    : 'flex-col';

  return (
    <div className={`inline-flex ${orientationStyles} ${className}`.trim()}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;

        const isFirst = index === 0;
        const isLast = index === React.Children.count(children) - 1;

        let additionalClasses = '';

        if (orientation === 'horizontal') {
          if (!isFirst && !isLast) {
            additionalClasses = 'rounded-none border-l-0';
          } else if (isFirst) {
            additionalClasses = 'rounded-r-none';
          } else if (isLast) {
            additionalClasses = 'rounded-l-none border-l-0';
          }
        } else {
          if (!isFirst && !isLast) {
            additionalClasses = 'rounded-none border-t-0';
          } else if (isFirst) {
            additionalClasses = 'rounded-b-none';
          } else if (isLast) {
            additionalClasses = 'rounded-t-none border-t-0';
          }
        }

        const childProps = child.props as { className?: string };
        return React.cloneElement(child, {
          className: `${childProps.className || ''} ${additionalClasses}`.trim()
        } as any);
      })}
    </div>
  );
};

export default ButtonGroup;

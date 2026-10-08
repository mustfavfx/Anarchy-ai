import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { BuilderContent, type BuilderContentProps } from './components/BuilderContent';

// Main exported component wrapped in ReactFlowProvider
export const BuilderPage: React.FC = () => {
  return (
    <ReactFlowProvider>
      <BuilderContent />
    </ReactFlowProvider>
  );
};

export { BuilderContent };
export type { BuilderContentProps };
export default BuilderPage;

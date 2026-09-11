import React from 'react';
import { ConfirmModal } from '../../../shared/components/ConfirmModal';
import { CreditErrorModal } from './CreditErrorModal';
import { DxfCalibrationModal } from './DxfCalibrationModal';

export interface BuilderCanvasModalsProps {
  confirmNewCanvas: boolean;
  onConfirmNewCanvas: () => void;
  onCancelNewCanvas: () => void;
  creditError: { balance: number; needed: number } | null;
  onCloseCreditError: () => void;
  dxfCalibrationTarget: { displayUrl: string; baseName: string } | null;
  onConfirmDxfExport: (calibration: any) => void;
  onCancelDxfCalibration: () => void;
}

export const BuilderCanvasModals: React.FC<BuilderCanvasModalsProps> = ({
  confirmNewCanvas,
  onConfirmNewCanvas,
  onCancelNewCanvas,
  creditError,
  onCloseCreditError,
  dxfCalibrationTarget,
  onConfirmDxfExport,
  onCancelDxfCalibration,
}) => {
  return (
    <>
      {/* Confirm New Canvas Modal */}
      {confirmNewCanvas && (
        <ConfirmModal
          title="New Canvas"
          message="You have unsaved changes. Start a new canvas anyway?"
          confirmLabel="Discard & Continue"
          danger
          onConfirm={onConfirmNewCanvas}
          onCancel={onCancelNewCanvas}
        />
      )}

      {/* Credit Error Modal */}
      {creditError && (
        <CreditErrorModal
          balance={creditError.balance}
          needed={creditError.needed}
          onClose={onCloseCreditError}
        />
      )}

      {/* DXF Scale Calibration Modal */}
      {dxfCalibrationTarget && (
        <DxfCalibrationModal
          imageUrl={dxfCalibrationTarget.displayUrl}
          onConfirm={onConfirmDxfExport}
          onCancel={onCancelDxfCalibration}
        />
      )}
    </>
  );
};

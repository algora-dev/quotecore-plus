import { FreeWorkspaceModal } from '@/components/marketing/FreeWorkspaceModal';
import { DoneForYouInquiryModal } from '@/components/marketing/DoneForYouInquiryModal';

/** Shared marketing conversion surfaces. Mount once per marketing document. */
export function MarketingConversionModals() {
  return (
    <>
      <FreeWorkspaceModal />
      <DoneForYouInquiryModal />
    </>
  );
}

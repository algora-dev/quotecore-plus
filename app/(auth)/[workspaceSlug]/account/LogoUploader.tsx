'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUploader } from '@/app/components/FileUploader';
import { uploadCompanyLogo } from './actions';

interface Props {
  companyId: string;
  currentLogoUrl: string | null;
}

export function LogoUploader({ companyId, currentLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);
  const router = useRouter();

  async function handleUpload(file: File) {
    const publicUrl = await uploadCompanyLogo(companyId, file);
    setLogoUrl(publicUrl);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Company Logo</h3>
      <p className="text-xs text-slate-500">
        This logo will appear on customer quotes. Recommended: 400×200px PNG with transparent background.
      </p>
      
      <FileUploader
        accept="image/jpeg,image/png,image/webp"
        maxSize={2097152} // 2 MB
        onUpload={handleUpload}
        currentFileUrl={logoUrl}
        label="Upload Logo"
        description="PNG, JPG or WebP (max 2 MB)"
      />
    </div>
  );
}

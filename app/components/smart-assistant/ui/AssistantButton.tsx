
'use client';
import {forwardRef,type ButtonHTMLAttributes} from 'react';
import {QcButton} from '@/app/components/ui/v2/QcButton';
export type AssistantButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'ghost';pending?:boolean;pendingLabel?:string};
/** Keeps the accepted P0 call signature while using the real shared C01. */
export const AssistantButton=forwardRef<HTMLButtonElement,AssistantButtonProps>(function AssistantButton({pending=false,pendingLabel='Saving...',children,...props},ref){
 return <QcButton {...props} ref={ref} pending={pending}>{pending?pendingLabel:children}</QcButton>;
});

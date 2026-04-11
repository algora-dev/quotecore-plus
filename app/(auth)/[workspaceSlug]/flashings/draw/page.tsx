import { FlashingCanvas } from './FlashingCanvas';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function DrawFlashingPage(props: Props) {
  const { workspaceSlug } = await props.params;

  return <FlashingCanvas workspaceSlug={workspaceSlug} />;
}

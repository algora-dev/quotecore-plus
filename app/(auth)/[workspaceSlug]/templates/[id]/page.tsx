import { loadTemplate } from '../data';
import { getTemplateRoofAreas, getTemplateComponents } from '../actions';
import { getComponents } from '../../components/actions';
import { TemplateDetail } from './template-detail';

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const [template, roofAreas, templateComponents, libraryComponents] = await Promise.all([
    loadTemplate(id),
    getTemplateRoofAreas(id),
    getTemplateComponents(id),
    loadComponentLibrary(),
  ]);

  return (
    <TemplateDetail
      template={template}
      roofAreas={roofAreas}
      templateComponents={templateComponents}
      libraryComponents={libraryComponents}
      workspaceSlug={workspaceSlug}
    />
  );
}

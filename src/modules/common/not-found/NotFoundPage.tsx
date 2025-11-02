import { Button } from "@icupa/ui/button";
import {
  Page,
  PageActions,
  PageContainer,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/layout/Page";
import { PrefetchNavLink } from "@/components/common/PrefetchNavLink";
import { useTranslation } from "react-i18next";

export const NotFoundPage = () => {
  const { t } = useTranslation();

  return (
    <Page variant="neutral">
      <PageContainer
        width="narrow"
        className="items-center justify-center text-center"
      >
        <PageHeader className="items-center gap-3 text-center">
          <PageTitle className="text-5xl font-black tracking-tight">404</PageTitle>
          <PageDescription className="text-base">
            <span className="font-semibold">{t("notFound.title")}</span> {t("notFound.description")}
          </PageDescription>
        </PageHeader>
        <PageActions className="justify-center">
          <Button asChild size="lg">
            <PrefetchNavLink to="/">{t("notFound.cta")}</PrefetchNavLink>
          </Button>
        </PageActions>
      </PageContainer>
    </Page>
  );
};

export default NotFoundPage;

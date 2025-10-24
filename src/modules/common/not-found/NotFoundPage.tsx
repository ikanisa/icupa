import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Page,
  PageActions,
  PageContainer,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/layout/Page";

export const NotFoundPage = () => {
  return (
    <Page variant="neutral">
      <PageContainer
        width="narrow"
        className="items-center justify-center text-center"
      >
        <PageHeader className="items-center gap-3 text-center">
          <PageTitle className="text-5xl font-black tracking-tight">404</PageTitle>
          <PageDescription className="text-base">
            We couldn’t find the surface you were looking for. Check the URL or return to the home experience.
          </PageDescription>
        </PageHeader>
        <PageActions className="justify-center">
          <Button asChild size="lg">
            <Link to="/">Return to home</Link>
          </Button>
        </PageActions>
      </PageContainer>
    </Page>
  );
};

export default NotFoundPage;

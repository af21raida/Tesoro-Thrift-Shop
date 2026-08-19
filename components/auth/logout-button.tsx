import { logoutAction } from "@/actions/auth/logout";
import { Button } from "@/components/ui/button";

export function LogoutButton(): React.JSX.Element {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="secondary">
        Log out
      </Button>
    </form>
  );
}

import { Menu } from "@base-ui/react/menu";
import { Icons } from "./icons";

function MenuArrow({ className, ...props }: React.ComponentProps<typeof Menu.Arrow>) {
  return (
    <Menu.Arrow
      className="data-[side=bottom]:top-[-8px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180"
      {...props}
    >
      <Icons.arrow className={className as string} />
    </Menu.Arrow>
  );
}
MenuArrow.displayName = "MenuArrow";

export { Menu, MenuArrow };

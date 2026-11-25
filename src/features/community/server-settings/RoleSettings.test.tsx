import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { RoleSettings } from "./RoleSettings";
import type { ServerSettingsData } from "./types";
const update=vi.fn().mockResolvedValue({});
vi.mock("./api",()=>({
 useServerRoles:()=>({data:{items:[{id:"default",name:"@everyone",is_default:true,position:0,permissions:["channels.view"],member_count:2},{id:"member",name:"Member",is_default:false,position:1,permissions:[],member_count:2}]}}),
 useCreateServerRole:()=>({mutateAsync:vi.fn()}), useReorderServerRoles:()=>({mutateAsync:vi.fn()}), useUpdateServerRole:()=>({mutateAsync:update,isPending:false}),useDeleteServerRole:()=>({}),useRoleMembers:()=>({}),useAddRoleMember:()=>({}),useRemoveRoleMember:()=>({}),
}));
function setup(){render(<QueryClientProvider client={new QueryClient()}><RoleSettings settings={{id:"server"} as ServerSettingsData} canManage /></QueryClientProvider>);fireEvent.click(screen.getByRole("button",{name:/Default Permissions/}));}
describe("default permissions",()=>{
 it("preserves drafts across group searches and shows unavailable features honestly",()=>{
  setup();fireEvent.click(screen.getByRole("switch",{name:"Send Messages"}));
  const search=screen.getByRole("textbox",{name:"Search permissions"});
  fireEvent.change(search,{target:{value:"Voice Channel Permissions"}});
  expect(screen.getByRole("switch",{name:"Connect"})).toBeDisabled();
  expect(screen.queryByRole("switch",{name:"Send Messages"})).not.toBeInTheDocument();
  fireEvent.change(search,{target:{value:"no such permission"}});
  expect(screen.getByRole("status")).toHaveTextContent("No permissions match");
  fireEvent.change(search,{target:{value:""}});
  expect(screen.getByRole("switch",{name:"Send Messages"})).toHaveAttribute("aria-checked","true");
 });
 it("confirms clearing permissions without saving or removing the role",()=>{
  setup();const view=screen.getByRole("switch",{name:"View Channels"});fireEvent.click(screen.getByRole("button",{name:"Clear Permissions"}));
  expect(view).toHaveAttribute("aria-checked","true");
  fireEvent.click(screen.getAllByRole("button",{name:"Clear Permissions"}).at(-1)!);
  expect(screen.getByRole("switch",{name:"View Channels"})).toHaveAttribute("aria-checked","false");
  fireEvent.click(screen.getByRole("button",{name:"Reset"}));
  expect(screen.getByRole("switch",{name:"View Channels"})).toHaveAttribute("aria-checked","true");
 });
 it("opens permissions and excludes assignment and display tabs",()=>{
  setup();expect(screen.getByRole("switch",{name:"Administrator"})).toBeDisabled();
  expect(screen.queryByRole("button",{name:/Manage Members/})).not.toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Display"})).not.toBeInTheDocument();
 });
 it("saves only default permission fields and supports draft reset",async()=>{
  update.mockClear();setup();
  fireEvent.click(screen.getByRole("switch",{name:"Send Messages"}));
  fireEvent.click(screen.getByRole("button",{name:"Reset"}));
  expect(screen.getByRole("switch",{name:"Send Messages"})).toHaveAttribute("aria-checked","false");
  fireEvent.click(screen.getByRole("switch",{name:"Send Messages"}));
  fireEvent.click(screen.getByRole("button",{name:"Save Changes"}));
  await waitFor(()=>expect(update).toHaveBeenCalledOnce());
  expect(update.mock.calls[0]![0]).toMatchObject({roleId:"default",permissions:["channels.view","messages.send"]});
  expect(JSON.stringify(update.mock.calls[0]![0])).not.toMatch(/"(name|color|position|hoist|mentionable)":/);
 });
});

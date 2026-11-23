import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, it, expect, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { ChannelContextMenu } from "./ChannelContextMenu";

afterEach(() => vi.unstubAllGlobals());
function setup(canManage: boolean, failPreferences = false) {
  const fetcher = vi.fn(async () => failPreferences ? Response.json({error:"Unavailable"}, {status:503}) : Response.json({is_muted:false,muted_until:null,notification_mode:"default"}));
  vi.stubGlobal("fetch",fetcher);
  const api = createApiClient({baseUrl:"https://core.test",sessionSignal:()=>new AbortController().signal,onUnauthorized:async()=>"active"});
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
  if (!failPreferences) client.setQueryData(["channel-preferences","channel"],{is_muted:false,muted_until:null,notification_mode:"default"});
  const onEdit=vi.fn();
  render(<QueryClientProvider client={client}><AppDataContext.Provider value={{api,ready:true,configured:true,configurationError:null,clearPrivateData:vi.fn()}}><MemoryRouter><ChannelContextMenu channel={{id:"channel",name:"general",topic:"A topic",position:0,kind:"text"}} communityId="community" position={{x:20,y:20}} canManage={canManage} onDismiss={vi.fn()} onEdit={onEdit} onCreate={vi.fn()} returnFocus={null} /></MemoryRouter></AppDataContext.Provider></QueryClientProvider>);
  return {onEdit,fetcher};
}
describe("channel context menu",()=>{
  it("offers retry after a preference failure and retains management actions",async()=>{
    const {fetcher}=setup(true,true);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load preferences");
    expect(screen.getByRole("menuitem",{name:"Edit Channel"})).toBeInTheDocument();
    expect(screen.getByRole("menuitem",{name:/Notification Settings/})).toHaveAttribute("data-disabled");
    fetcher.mockImplementation(async()=>Response.json({is_muted:false,muted_until:null,notification_mode:"default"}));
    fireEvent.click(screen.getByRole("button",{name:"Retry"}));
    await waitFor(()=>expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("menuitem",{name:/Notification Settings/})).not.toHaveAttribute("data-disabled");
  });
  it("hides management actions from ordinary members",()=>{
    setup(false);
    expect(screen.getByRole("menuitem",{name:/Mute Channel/})).toBeInTheDocument();
    expect(screen.queryByRole("menuitem",{name:"Delete Channel"})).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem",{name:"Edit Channel"})).not.toBeInTheDocument();
  });
  it("opens existing settings for managers",()=>{
    const {onEdit}=setup(true);
    fireEvent.click(screen.getByRole("menuitem",{name:"Edit Channel"}));
    expect(onEdit).toHaveBeenCalledOnce();
  });
  it("requires confirmation before deleting",()=>{
    setup(true);
    fireEvent.click(screen.getByRole("menuitem",{name:"Delete Channel"}));
    expect(screen.getByRole("dialog")).toHaveTextContent("cannot be undone");
    expect(screen.getByRole("button",{name:"Cancel"})).toBeInTheDocument();
  });
});

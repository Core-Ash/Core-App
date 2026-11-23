import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { AppDataContext } from "@/app/app-data-context";
import { createApiClient } from "@/lib/api/client";
import { PermissionsEditor } from "./PermissionsEditor";
const snapshot={version:"v1",resource:{name:"general",kind:"text"},entries:[],roles:[{id:"everyone",name:"@everyone",is_default:true,color:null}],members:[{id:"member",name:"Ash",username:"ash",avatar_url:null}]};
afterEach(()=>vi.unstubAllGlobals());
function setup(fail=false){
 const fetcher=vi.fn(async(_url:string,options?:RequestInit)=>options?.method==="PUT"&&fail?Response.json({}, {status:403}):Response.json(snapshot));
 vi.stubGlobal("fetch",fetcher);
 const api=createApiClient({baseUrl:"https://core.test",sessionSignal:()=>new AbortController().signal,onUnauthorized:async()=>"active"});
 const queries=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={queries}><AppDataContext.Provider value={{api,ready:true,configured:true,configurationError:null,clearPrivateData:vi.fn()}}><PermissionsEditor communityId="server" resourceId="channel" /></AppDataContext.Provider></QueryClientProvider>);
 return fetcher;
}
it("edits explicit tri-state overrides and saves only changes with a conflict token",async()=>{
 const fetcher=setup();
 const allow=await screen.findByRole("button",{name:"Allow Send Messages"});
 expect(screen.getByRole("button",{name:"Neutral Send Messages"})).toHaveAttribute("aria-pressed","true");
 fireEvent.click(allow);expect(allow).toHaveAttribute("aria-pressed","true");
 fireEvent.click(screen.getByRole("button",{name:"Save Changes"}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(3));
 const save=fetcher.mock.calls.find(c=>c[1]?.method==="PUT")!;
 expect(JSON.parse(save[1]!.body as string)).toEqual({version:"v1",sync:false,changes:[{kind:"role",id:"everyone",permission:"messages.send",state:true}]});
});
it("preserves the draft when a save is rejected",async()=>{
 setup(true);fireEvent.click(await screen.findByRole("button",{name:"Deny Send Messages"}));
 fireEvent.click(screen.getByRole("button",{name:"Save Changes"}));
 expect(await screen.findByRole("alert")).toHaveTextContent("Your draft is preserved");
 expect(screen.getByRole("button",{name:"Deny Send Messages"})).toHaveAttribute("aria-pressed","true");
});
it("searches only implemented permissions",async()=>{
 setup();const search=await screen.findByRole("textbox",{name:"Search permissions"});fireEvent.change(search,{target:{value:"send"}});
 expect(screen.getByRole("group",{name:"Send Messages"})).toBeInTheDocument();
 expect(screen.queryByRole("group",{name:"View Channel"})).not.toBeInTheDocument();
});
